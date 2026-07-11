export const getBearerToken = (authorization?: string): string | null => {
	if (!authorization) return null;

	const match = authorization.match(/^Bearer\s+(.+)$/i);

	return match ? match[1] : null;
};