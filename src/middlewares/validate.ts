import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

const formatIssues = (issues: Array<{ path: (string | number)[]; message: string }>) =>
  issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'body',
    message: issue.message,
  }));

const applyParsedRequestData = (
  req: Request,
  data: Record<string, unknown>,
) => {
  if ('body' in data) {
    req.body = data.body as Request['body'];
  } else {
    req.body = data as Request['body'];
  }

  if ('params' in data) {
    req.params = data.params as Request['params'];
  }

  if ('query' in data) {
    req.query = data.query as Request['query'];
  }
};

export const validateRequest = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const bodyResult = schema.safeParse(req.body);
    const requestResult = bodyResult.success
      ? bodyResult
      : schema.safeParse({
          body: req.body,
          params: req.params,
          query: req.query,
        });

    if (!requestResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formatIssues(requestResult.error.issues),
      });
      return;
    }

    applyParsedRequestData(req, requestResult.data as Record<string, unknown>);

    next();
  };
};

export const validateBody = validateRequest;
