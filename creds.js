//Put your Clockify credentials here and, if you want to store the file on a 'safer' location, just change the reference to this file at script.js[1]
const creds = {
	apiKey: "yourApiKey",
	workspace: "yourWorkspaceId",
	userId: "yourUserId"
};

const targets = {
	"workweek": 2400, // 40h (total workweek hours except "ej")
	"targetHours": 50, // Weekly target in hours
	"ej": 600, // 10h project
	"w": { default: 600, ratio: 0.25 }, // default target and ratio if default doesn't apply (other higher priority projects)
	"pract": { default: 1104, ratio: 0.46 },
	"lb": { default: 48, ratio: 0.02 },
	"p": { default: 288, ratio: 0.12 },
	"eng": { default: 360, ratio: 0.15 },
	"lbt": 1200,
	pendingColor: 'firebrick',
	doneColor: 'forestgreen'
};
export { creds, targets };