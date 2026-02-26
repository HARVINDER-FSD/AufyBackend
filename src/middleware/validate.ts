// src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import Joi, { Schema } from 'joi';

/**
 * Generic request body validator using Joi schema.
 * If validation fails, responds with 400 and the first error message.
 */
export function validateBody(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error, value } = schema.validate(req.body, { abortEarly: true, stripUnknown: true });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        // Replace req.body with validated value (important for defaults and stripping)
        req.body = value;
        next();
    };
}
