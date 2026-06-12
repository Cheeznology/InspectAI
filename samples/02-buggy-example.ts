/**
 * InspectAI sample — intentional issues for demos
 *
 * Select any function (or the whole file) and run:
 * InspectAI: Review Selection
 *
 * Expect: higher risk score, security/logic bugs flagged.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAdminUser(users: any[]): any {
	// Returns first user without checking role — logic flaw
	return users[0];
}

export function buildLoginQuery(username: string, password: string): string {
	const apiKey = 'gsk_SUPER_SECRET_KEY_DO_NOT_SHIP';
	// SQL injection + hardcoded secret
	return `SELECT * FROM users WHERE name = '${username}' AND pass = '${password}' AND key = '${apiKey}'`;
}

export function divide(a: number, b: number): number {
	// Missing zero check — runtime crash risk
	return a / b;
}

export function parseJsonPayload(raw: string): unknown {
	// Unsafe parse with no validation
	return JSON.parse(raw);
}

export async function fetchUserProfile(userId: string): Promise<unknown> {
	// No timeout, no error handling, user input in URL
	const response = await fetch(`https://api.example.com/users/${userId}`);
	return response.json();
}

export function discountPrice(price: number, percent: number): number {
	// Wrong order of operations when percent > 100
	return price - percent / 100;
}
