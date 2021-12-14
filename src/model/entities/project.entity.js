module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            title: {
                type: String,
                required: true,
            },
            generalObjective: {
                type: String,
                required: true,
            },
            specificObjectives: {
                type: [
                    {
                        _id: {
                            type: mongoose.ObjectId,
                            index: true,
                            required: true,
                            auto: true,
                        },
                        title: {
                            type: String,
                            required: true,
                        },
                        accomplished: {
                            type: Boolean,
                            required: true,
                            default: false,
                        },
                    },
                ],
                default: [],
            },
            budget: {
                type: Number,
                required: true,
                trim: true,
                default: 0,
            },
            status: {
                type: String,
                enum: ['activo', 'inactivo'],
                trim: true,
                default: 'inactivo',
            },
            stage: {
                type: String,
                enum: [null, 'iniciado', 'en desarrollo', 'terminado'],
                trim: true,
                default: null,
            },
            startDate: {
                type: String,
                required: true,
                trim: true,
            },
            finishDate: {
                type: String,
                required: true,
                trim: true,
            },
            leaderInCharge: {
                id: {
                    type: mongoose.ObjectId,
                    required: true,
                },
                fullName: {
                    type: String,
                    required: true,
                },
            },
            studentsInProject: {
                type: [
                    {
                        studentId: {
                            type: mongoose.ObjectId,
                            required: true,
                        },
                        fullName: {
                            type: String,
                            required: true,
                        },
                        inscriptionStatus: {
                            type: String,
                            enum: [null, 'aceptada', 'rechazada'],
                            required: true,
                            trim: true,
                            default: null,
                        },
                        dateOfAdmission: {
                            type: String,
                            trim: true,
                            default: null,
                        },
                        egressDate: {
                            type: String,
                            trim: true,
                            default: null,
                        },
                    },
                ],
                default: undefined,
            },
            progress: {
                type: [
                    {
                        _id: {
                            type: mongoose.ObjectId,
                            index: true,
                            required: true,
                            auto: true,
                        },
                        studentId: {
                            type: mongoose.ObjectId,
                            required: true,
                        },
                        studentFullName: {
                            type: String,
                            required: true,
                        },
                        description: {
                            type: String,
                            required: true,
                        },
                        createdDate: {
                            type: String,
                            trim: true,
                            default: new Date(),
                        },
                        observation: {
                            type: String,
                        },
                    },
                ],
                default: undefined,
            },
        },
        {
            timestamps: true,
        },
    );

    schema.method('toJSON', function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id.toHexString();
        return object;
    });

    const Project = mongoose.model('project', schema);
    return Project;
};
