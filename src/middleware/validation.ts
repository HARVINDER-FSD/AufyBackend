import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      return res.status(400).json({ error: errorMessage });
    }

    next();
  };
};

// Common Schemas
export const emailSchema = Joi.string().email().required();
export const passwordSchema = Joi.string().min(8).required();
export const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

export const loginSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  username: Joi.string().alphanum().min(3).max(30).required(),
  full_name: Joi.string().min(2).max(50).required(),
  dob: Joi.date().iso().optional(),
});
