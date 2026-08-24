import { ZodError } from 'zod';
export function validateBody(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const errorDetails = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));
                const firstMessage = error.errors[0]?.message || 'Validasi input gagal.';
                res.status(400).json({
                    success: false,
                    message: firstMessage,
                    errors: errorDetails,
                });
                return;
            }
            next(error);
        }
    };
}
