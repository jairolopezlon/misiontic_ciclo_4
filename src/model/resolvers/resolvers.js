const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'variables.env' });

//Definicion de esquemas de base de datos
const User = require(path.join('../entities', 'user.entity'))(mongoose);
const Project = require(path.join('../entities', 'project.entity'))(mongoose);

const createToken = (user) => {
    const { id, fullName, email, role } = user;

    return jwt.sign(
        {
            id,
            fullName,
            email,
            role,
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
        getProjectsActives: async () => {
            const result = await Project.find({ status: 'activo' });
            return result;
        },
        getProject: async (_, { id }) => {
            //Validar si el proyecto existe
            const result = await Project.findById({ _id: id }).populate('progress');
            if (!result) {
                throw new Error('El proyecto no existe');
            }
            return result;
        },
        getProjectsByLeader: async (root, {}, ctx) => {
            const result = await Project.find({ 'leaderInCharge.id': ctx.user.id });
            return result;
        },
        myProjects: async (_, {}, ctx) => {
            //Validar si el proyecto existe
            const result = await Project.find({ leaderInChange: ctx.user.id });
            if (!result) {
                throw new Error('No tiene proyectos');
            }
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

            //Crear token para el usuario
            return {
                token: createToken(isUser),
            };
        },
        updateUser: async (_, { id, input }) => {
            //Validar si el usuario esta registrado
            let isUser = await User.findById({ _id: id });
            if (!isUser) {
                throw new Error('El usuario no está registrado');
            }

            //Actualizar datos
            isUser = await User.findOneAndUpdate({ _id: id }, input, { new: true });

            return isUser;
        },
        activateUser: async (_, { id, input }) => {
            //Validar si el usuario esta registrado
            let isUser = await User.findById({ _id: id });
            if (!isUser) {
                throw new Error('El usuario no está registrado');
            }

            //Actualizar datos
            isUser = await User.findOneAndUpdate({ _id: id }, input, { new: true });

            return isUser;
        },
        registerProject: async (_, { input }, ctx) => {
            if (ctx.user.role != process.env.ROLE_LEADER) {
                throw new Error('El usuario no es Líder');
            }

            // Registrar proyecto
            const record = new Project(input);
            //Asignar lider de proyecto
            record.leaderInChange = ctx.user.id;
            try {
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
        updateProjectData: async (root, { projectId, input }) => {
            const projectExist = await Project.find({ _id: projectId });

            if (!projectExist) {
                throw new Error('El Proyecto consultado no existe');
            }

            const result = await Project.findOneAndUpdate({ _id: projectId }, { $set: input }, { new: true });

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
            console.log({ ctx });
            if (ctx.user.role != process.env.ROLE_STUDENT) {
                throw new Error('El usuario no es Estudiante');
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
    },
};

module.exports = resolvers;
