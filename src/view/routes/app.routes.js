const express = require('express');
const router = express.Router();


// welcome route
router.get("/", (req, res) => {
    res.json({
        message: "Bienvenido a la API para la Gestión de Proyectos de Investigación."
    });
});


module.exports = router;