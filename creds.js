// Clockify credentials
const creds = {
	apiKey: "yourApiKey",
	workspace: "yourWorkspaceId",
	userId: "yourUserId"
};

const targets = {
	"workweek": 2400, // 40h (total workweek hours except "ej")
	"targetHours": { default: 50, max: +10 }, // Weekly target in hours
	"ej": { default: 600, recovery: -10 }, // 10h project
	"lbt": 1200,
	"w": { default: 600, ratio: 0.25, recovery: -294 }, // default target and ratio if default doesn't apply (other higher priority projects)
	"pract": { default: 1104, ratio: 0.46, recovery: 291 },
	"lb": { default: 48, ratio: 0.02, recovery: -220 },
	"p": { default: 288, ratio: 0.12, recovery: -916 },
	"eng": { default: 360, ratio: 0.15, recovery: -1 },
	// recovery is a modifier that involves previous surpluses of times and is 
	// used to adjust targets accordingly 
	pendingColor: 'firebrick',
	recoveryColor: 'coral',
	doneColor: 'forestgreen'
};
export { creds, targets };