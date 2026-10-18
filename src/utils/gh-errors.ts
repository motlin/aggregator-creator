const GH_NOT_AUTHENTICATED_MESSAGE =
	'GitHub CLI is not authenticated. Run `gh auth login` or set the GH_TOKEN environment variable.';

export interface GhErrorDescription {
	authenticated: boolean;
	message: string;
}

/**
 * Turn the message of a failed gh invocation into a short explanation, collapsing gh's multi-line
 * "please run gh auth login" hint into one sentence so callers can report it once.
 */
export function describeGhError(message: string): GhErrorDescription {
	if (message.includes('gh auth login')) {
		return {authenticated: false, message: GH_NOT_AUTHENTICATED_MESSAGE};
	}

	return {authenticated: true, message: message.trim()};
}
