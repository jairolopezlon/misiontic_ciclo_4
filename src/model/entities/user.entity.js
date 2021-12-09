module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            documentId: {
                type: String,
                required: true,
                trim: true,
                unique: true,
            },
            email: {
                type: String,
                required: true,
                trim: true,
                unique: true,
            },
            fullName: {
                type: String,
                required: true,
                trim: false,
            },
            password: {
                type: String,
                required: true,
                trim: true,
            },
            role: {
                type: String,
                enum: ['ESTUDIANTE', 'LÍDER', 'ADMINISTRADOR'],
                required: true,
                trim: true,
            },
            status: {
                type: String,
                enum: ['PENDIENTE', 'AUTORIZADO', 'NO AUTORIZADO'],
                required: true,
                trim: true,
                default: 'PENDIENTE',
            },
            address: {
                type: String,
                required: true,
            },
            phone: {
                type: String,
                required: true,
                trim: true,
            },
        },
        {
            timestamps: true,
        },
    );

    schema.method('toJSON', function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });

    const User = mongoose.model('user', schema);
    return User;
};
