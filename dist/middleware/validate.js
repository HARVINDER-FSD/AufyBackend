"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
/**
 * Generic request body validator using Joi schema.
 * If validation fails, responds with 400 and the first error message.
 */
function validateBody(schema) {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: true, stripUnknown: true });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        // validated (and possibly stripped) data is now in req.body
        next();
    };
}
