/**
 * InspectAI sample — clean code
 *
 * Select any function (or the whole file) and run:
 * InspectAI: Review Selection
 *
 * Expect: low risk score, few or no issues, positive notes.
 */

export interface User {
	id: string;
	email: string;
	displayName: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
	if (!email || email.length > 254) {
		return false;
	}
	return EMAIL_PATTERN.test(email.trim().toLowerCase());
}

export function findUserById(users: readonly User[], id: string): User | undefined {
	if (!id) {
		return undefined;
	}
	return users.find((user) => user.id === id);
}

export function formatDisplayName(user: User | undefined): string {
	if (!user) {
		return 'Guest';
	}
	const name = user.displayName.trim();
	return name.length > 0 ? name : user.email;
}

export function averageScore(scores: readonly number[]): number | null {
	if (scores.length === 0) {
		return null;
	}
	const total = scores.reduce((sum, score) => sum + score, 0);
	return Math.round((total / scores.length) * 100) / 100;
}
