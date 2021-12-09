const {ApolloServer} = require('apollo-server');
require('dotenv').config({path:'variables.env'});
const express = require('express');
const jwt = require("jsonwebtoken");
const morgan = require('morgan');
const path = require('path');

//Cargue de Schemes y Resolvers de GraphQL
const typeDefs = require('./model/schemes/schema');
const resolvers = require('./model/resolvers/resolvers');

//Conexión a la DB
const database = require(path.join(__dirname,'model', 'config','database'));
database.conectarBD();

// Servidor
//const app = express();
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({req})=>{

        const tkn = req.headers['authorization'] || '';

        if (tkn) {
            try {
                const user = jwt.verify(tkn, process.env.SECRET_JWT);

                return{
                    user
                }
            } catch (err) {
                console.log("¡Ha ocurrido un error!", err);
            }
        }
    }
});


// Settings
//app.set('port', process.env.PORT || 4000);

// Middlewares
//app.use(morgan('dev'));
//app.use(express.json());

//Routes
//app.use('/api/gpi', require(path.join(__dirname, 'view', 'routes','app.routes')));

//Static files
//app.use(express.static(path.join(__dirname, 'view', 'public')));

// Starting the server
/*app.listen(app.get('port'), () => {
    console.log(`Server on port ${app.get('port')}`);
});*/

// Starting the server
server.listen().then( ({url}) => {
    console.log(`Server on port ${url}`);
});