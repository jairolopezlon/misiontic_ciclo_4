const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({path:'variables.env'})

const database = {};

// Creación de conexión a la base de datos
const conectarBD = async()=>{
    try {
        console.log("¡Conectando con la base de datos!");
        await mongoose.connect(process.env.DB_MONGO, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("¡Se logró la conexión con la base de datos!");
    } catch (err) {
        console.log("¡No se logró la conexión con la base de datos!", err);
        process.exit(1);
    }
}
database.conectarBD = conectarBD

module.exports = database;