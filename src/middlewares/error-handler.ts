import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../controllers/auth/user.js';
import { ApiError } from '../utils/api-error.js';

const formatDuplicateKey = (error: { keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> }) => {
  const fields = Object.keys(error.keyPattern ?? {});

  if (fields.includes('email')) {
    return 'An account with this email already exists';
  }

  return 'This record already exists';
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.errors.length > 0 ? { errors: error.errors } : {}),
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }

  if (error?.code === 11000) {
    res.status(409).json({
      success: false,
      message: formatDuplicateKey(error),
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ success: false, message: 'Request body contains invalid JSON' });
    return;
  }

  if (error?.name === 'CastError') {
    res.status(400).json({ success: false, message: 'Invalid resource identifier' });
    return;
  }

  console.error(error);
  res.status(500).json({ success: false, message: 'Internal server error' });
};
