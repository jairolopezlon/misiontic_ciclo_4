const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ContextualizedQueryLatencyStats } = require('apollo-reporting-protobuf');
require('dotenv').config();

//Definicion de esquemas de base de datos
const User = require(path.join('../entities', 'user.entity'))(mongoose);
const Project = require(path.join('../entities', 'project.entity'))(mongoose);

const createToken = (user) => {
    const { id, fullName, email, role, status } = user;

    return jwt.sign(
        {
            id,
            fullName,
            email,
            role,
            status,
        },
        process.env.SECRET_JWT,
        {
            expiresIn: Number(process.env.EXPIRATION_JWT),
        },
    );
};

const resolvers = {
    Query: {
        // Operaciones de la entidad User
        getUsers: async () => {
            const result = await User.find({});
            return result;
        },
        getUser: async (_, { id }) => {
            //Validar si el proyecto existe
            const result = await User.findById({ _id: id });
            if (!result) {
                throw new Error('El usuario no existe');
            }
            return result;
        }, // Operaciones de la entidad Project
        getProjects: async () => {
            const result = await Project.find({});
            return result;
        },
        getActivesProjects: async () => {
            const result = await Project.find({ status: 'activo' });
            return result;
        },
        getProject: async (root, { proyectId }, ctx) => {
            //Validar si el proyecto existe
            const result = await Project.findOne({ _id: proyectId, 'leaderInCharge.id': ctx.user.id });
            if (!result) {
                throw new Error('El proyecto no existe');
            }
            return result;
        },
        getProjectsByLeader: async (root, { leaderId }, ctx) => {
            console.log({ leaderId });
            const id = leaderId || ctx.user.id;
            const result = await Project.find({ 'leaderInCharge.id': id });
            return result;
        },
        getStudents: async (root, {}, ctx) => {
            const result = await User.find({ role: 'ESTUDIANTE' });
            return result;
        },
        getInscriptions: async (root, {}, ctx) => {
            const result = await Project.find(
                {
                    'leaderInCharge.id': ctx.user.id,
                    'studentsInProject.inscriptionStatus': null,
                },
                { _id: 1, title: 1, studentsInProject: 1 },
            );
            result.map((project) => {
                let studentsWithoutAnswer = project.studentsInProject.filter((student) => {
                    return student.inscriptionStatus == null;
                });
                project.studentsInProject = studentsWithoutAnswer;
                return project;
            });
            return result;
        },
        getProgressByProject: async (root, { projectId }, ctx) => {
            const result = await Project.findOne(
                {
                    _id: projectId,
                    'studentsInProject.studentId': ctx.user.id,
                },
                { id: 1, title: 1, progress: 1 },
            );
            console.log(JSON.stringify(result, null, 1));

            return result;
        },
    },

    Mutation: {
        registerUser: async (_, { input }) => {
            const { email, password } = input;

            //Validar si el usuario esta registrado
            const isUser = await User.findOne({ email });
            if (isUser) {
                throw new Error('El usuario ya está registrado');
            }

            // Encriptar password
            input.password = bcrypt.hashSync(password, 10);

            // Registrar usuario
            try {
                const record = new User(input);
                record.save();
                return record;
            } catch (err) {
                console.log('¡No se logró registrar el usuario!', err);
            }
        },
        authenticateUser: async (_, { input }) => {
            const { email, password } = input;

            //Validar si el usuario esta registrado
            const isUser = await User.findOne({ email });
            if (!isUser) {
                throw new Error('El usuario no está registrado');
            }

            //Validar si el password del usuario es correcto
            const isPassword = await bcrypt.compare(password, isUser.password);
            if (!isPassword) {
                throw new Error('El password no es correcto');
            }

            if (isUser.status != 'AUTORIZADO') {
                throw new Error('El usuario aun no se encuentra autorizado para ingreso');
            }

            //Crear token para el usuario
            return {
                token: createToken(isUser),
            };
        },
        updateUser: async (_, { id, input }, ctx) => {
            //Validar si el usuario esta registrado
            let isUser = await User.findById({ _id: id });
            if (!isUser) {
                throw new Error('El usuario no está registrado');
            }
            if (isUser.status != 'AUTORIZADO') {
                throw new Error(
                    'El usuario está registrado, pero está pendiente la aprobación del registro en la aplicación.',
                );
            }
            if (input.password) {
                input.password = bcrypt.hashSync(input.password, 10);
            }

            //Actualizar datos
            isUser = await User.findOneAndUpdate({ _id: id }, input, { new: true });

            if (input.fullName) {
                const { role } = ctx.user;

                if (role == process.env.ROLE_STUDENT) {
                    await Project.updateMany(
                        { $or: [{ 'studentsInProject.studentId': id }, { 'progress.studentId': id }] },
                        {
                            $set: {
                                'studentsInProject.$[studentsInProject].fullName': input.fullName,
                                'progress.$[progress].studentFullName': input.fullName,
                            },
                        },
                        { arrayFilters: [{ 'progress.studentId': id }, { 'studentsInProject.studentId': id }] },
                    );
                }
                if (role == process.env.ROLE_LEADER) {
                    await Project.updateMany(
                        { 'leaderInCharge.id': id },
                        { $set: { 'leaderInCharge.fullName': input.fullName } },
                    );
                }
            }

            return isUser;
        },
        activateUser: async (_, { id, status }, ctx) => {
            //Validar si el usuario esta registrado
            // console.log({ ctx });

            if (ctx.user.role == process.env.ROLE_STUDENT) {
                throw new Error('Los usuarios con rol de estudiante no pueden activar usuarios');
            }

            let userToActivate = await User.findById({ _id: id }, { _id: 0, role: 1, status: 1 });
            if (!userToActivate) {
                throw new Error('El usuario no está registrado');
            }

            if (ctx.user.role == process.env.ROLE_LEADER && userToActivate.role != process.env.ROLE_STUDENT) {
                throw new Error('Los usuarios con rol de líder solo pueden activar usuarios con rol de estudiante');
            }

            userToActivate = await User.findOneAndUpdate({ _id: id }, { status }, { new: true });

            return userToActivate;
        },
        registerProject: async (_, { input }, ctx) => {
            if (ctx.user.role != process.env.ROLE_LEADER) {
                throw new Error('El usuario no es Líder');
            }
            input.leaderInCharge = { id: ctx.user.id, fullName: ctx.user.fullName };

            // Registrar proyecto
            try {
                const record = new Project(input);
                const result = await record.save();
                return result;
            } catch (err) {
                console.log('¡No se logró registrar el proyecto!', err);
            }
        },
        registerProgressInProject: async (_, { projectId, description }, ctx) => {
            if (ctx.user.role != process.env.ROLE_STUDENT) {
                throw new Error('El usuario no es Estudiante');
            }

            const input = {};
            input.studentId = ctx.user.id;
            input.studentFullName = ctx.user.fullName;
            input.description = description;

            const result = await Project.findOneAndUpdate(
                { _id: projectId },
                { $push: { progress: input }, $set: { stage: 'en desarrollo' } },
                { new: true },
            );
            return result;
        },
        updateProjectData: async (root, { projectId, input }, ctx) => {
            const projectExist = await Project.findOne({ _id: projectId, 'leaderInCharge.id': ctx.user.id });

            if (!projectExist) {
                throw new Error('El Proyecto consultado no existe o no es es el líder encargado');
            }

            const result = await Project.findOneAndUpdate(
                { _id: projectId, 'leaderInCharge.id': ctx.user.id },
                { $set: input },
                { new: true },
            );

            return result;
        },
        updateProgressDescription: async (root, { projectId, progressId, description }) => {
            const result = Project.findOneAndUpdate(
                { _id: projectId },
                { $set: { 'progress.$[progress].description': description } },
                { arrayFilters: [{ 'progress._id': progressId }], new: true },
            );

            return result;
        },
        updateProgressObservation: async (root, { projectId, progressId, observation }) => {
            const result = Project.findOneAndUpdate(
                { _id: projectId },
                { $set: { 'progress.$[progress].observation': observation } },
                { arrayFilters: [{ 'progress._id': progressId }], new: true },
            );

            return result;
        },
        registerInProject: async (root, { projectId }, ctx) => {
            // console.log({ ctx });
            if (ctx.user.role != process.env.ROLE_STUDENT) {
                throw new Error('El usuario no es Estudiante');
            }

            const project = Project.findOne({ _id: projectId });

            if (!project) {
                throw new Error('El proyecto no existe');
            }

            const input = {};
            input.studentId = ctx.user.id;
            input.fullName = ctx.user.fullName;

            const result = await Project.findOneAndUpdate(
                { _id: projectId, status: 'activo' },
                { $push: { studentsInProject: input } },
                { new: true },
            );
            console.log(JSON.stringify(result, null, 2));
            return result;
        },
        updateProjectStatus: async (root, { projectId, status }, ctx) => {
            if (ctx.user.role != process.env.ROLE_ADMIN) {
                throw new Error('El usuario no es Administrador');
            }
            const { stage } = await Project.findOne({ _id: projectId });
            let result;
            if (status === 'activo') {
                if (stage != 'terminado') {
                    if (stage === null) {
                        result = Project.findOneAndUpdate(
                            { _id: projectId },
                            {
                                $set: {
                                    status: status,
                                    stage: 'iniciado',
                                    startDate: new Date(),
                                },
                            },
                            { new: true },
                        );
                    } else {
                        result = Project.findOneAndUpdate(
                            { _id: projectId },
                            {
                                $set: {
                                    status: status,
                                },
                            },
                            { new: true },
                        );
                    }
                } else {
                    throw new Error('No se puede activar un proyecto que ya se encuentra terminado');
                }
            }

            if (status === 'inactivo') {
                result = Project.findOneAndUpdate(
                    { _id: projectId },
                    {
                        $set: {
                            status: status,
                            'studentsInProject.$[student].egressDate': new Date(),
                        },
                    },
                    {
                        arrayFilters: [
                            {
                                'student.egressDate': null,
                                'student.inscriptionStatus': 'aceptada',
                            },
                        ],
                        new: true,
                    },
                );
            }
            return result;
        },
        finishProject: async (root, { projectId }, ctx) => {
            if (ctx.user.role != process.env.ROLE_ADMIN) {
                throw new Error('El usuario no es Administrador');
            }
            const { stage } = await Project.findOne({ _id: projectId });

            if (stage === 'terminado') {
                throw new Error('El proyecto ya esta terminado');
            }
            if (stage != 'en desarrollo') {
                throw new Error('El proyecto no esta en estado "en desarrollo", no se puede terminar');
            }
            const result = await Project.findOneAndUpdate(
                { _id: projectId },
                {
                    $set: {
                        stage: 'terminado',
                        status: 'inactivo',
                        finishDate: new Date(),
                        'studentsInProject.$[student].egressDate': new Date(),
                    },
                },
                {
                    arrayFilters: [
                        {
                            'student.egressDate': null,
                            'student.inscriptionStatus': 'aceptada',
                        },
                    ],
                    new: true,
                },
            );
            return result;
        },
        updateSpecificObjective: async (root, { projectId, objectiveId, title }, ctx) => {
            const projectExist = await Project.findOne({ _id: projectId, 'leaderInCharge.id': ctx.user.id });

            if (!projectExist) {
                throw new Error('El Proyecto consultado no existe o no es es el líder encargado');
            }

            const result = await Project.findOneAndUpdate(
                { _id: projectId, 'leaderInCharge.id': ctx.user.id },
                { $set: { 'specificObjectives.$[objective].title': title } },
                { arrayFilters: [{ 'objective._id': objectiveId }], new: true },
            );

            return result;
        },
        setStatusSpecificObjective: async (root, { projectId, objectiveId, accomplished }, ctx) => {
            const projectExist = await Project.findOne({ _id: projectId, 'leaderInCharge.id': ctx.user.id });

            if (!projectExist) {
                throw new Error('El Proyecto consultado no existe o no es es el líder encargado');
            }

            const result = await Project.findOneAndUpdate(
                { _id: projectId, 'leaderInCharge.id': ctx.user.id },
                { $set: { 'specificObjectives.$[objective].accomplished': accomplished } },
                { arrayFilters: [{ 'objective._id': objectiveId }], new: true },
            );

            return result;
        },
        updateInscriptionStatus: async (root, { projectId, studentId, inscriptionStatus }, ctx) => {
            const result = Project.findOneAndUpdate(
                { _id: projectId },
                {
                    $set: {
                        'studentsInProject.$[student].inscriptionStatus': inscriptionStatus,
                        'studentsInProject.$[student].dateOfAdmission': new Date(),
                    },
                },
                {
                    arrayFilters: [{ 'student.studentId': studentId }],
                    new: true,
                    fields: { _id: 1, title: 1, studentsInProject: 1 },
                },
            );
            return result;
        },
    },
};

module.exports = resolvers;
