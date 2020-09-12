import { creds, targets } from './creds.js'; // Credentials for the api 

/// Dates to pass on to the request (start and end as ISO strings):

const getMonday = () => {
	const d = new Date(),
		day = d.getDay();
	// calculate the day to set as Monday (0)
	const diff = d.getDate() - day + (day === 0 ? -6 : 1); //adjust for Sundays
	return new Date(d.setDate(diff));
};

const monday = getMonday(),
	start = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0)).toISOString(); // Mon, 00:00:00 (UTC/ISO)

const today = new Date(),
	end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)).toISOString(); // Today, 23:59:59 (UTC/ISO)

/// Add week number to page title

Date.prototype.getWeek = function () {//https://stackoverflow.com/questions/9045868/javascript-date-getweek
	let oneJan = new Date(this.getFullYear(), 0, 1);
	return Math.ceil((((this - oneJan) / 86400000) + oneJan.getDay() - 1) / 7);
};

document.querySelector('h1').textContent += ` (${today.getFullYear().toString().slice(2)}${today.getWeek()})`;
console.log(today.getYear());

//______________________________________________________________________________

const durMinutes = val => Math.round(val / 60),
	durHours = val => (val / 3600).toFixed(2),
	getId = val => document.getElementById(val);
let myList = document.querySelector('ul'),
	// Variables holding fetched data and default target times
	ej = targets.ej.default, lbt = targets.lbt;
fetch(
	`https://reports.api.clockify.me/v1/workspaces/${creds.workspace}/reports/summary`, {
	method: 'POST',
	headers: {
		'Accept': 'application/json',
		'Content-Type': 'application/json',
		"X-Api-Key": `${creds.apiKey}`
	},
	body: JSON.stringify({
		"dateRangeStart": start,
		"dateRangeEnd": end,
		"summaryFilter": {
			"groups": [
				"project",
				"timeentry"
			]
		}
	})
}
)
	.then(function (response) {
		if (!response.ok) {
			throw new Error("HTTP error, status = " + response.status);
		}
		return response.json();
	})
	.then(function (data) {
		// console.log('ok:', data);

		/// Redefine main target values according to defined ratios (creds.js) and to Lbt project if present

		let lbtDur;
		data.groupOne.filter(val => {
			if (val.name.includes('Lb')) {
				lbtDur = durMinutes(val.duration); // Duration in mins of lbt project 
			}
		});
		let ww = targets.workweek;

		const taskTargets = function (val) {
			if (lbtDur > 0) {// If there's record of lbt; calculate accordingly
				return Math.round((ww - lbtDur) * targets[val].ratio);
			}// If lbtDur surpasses workweek set to 0, otherwise load defaults
			return (lbtDur >= ww) ? 0 : targets[val].default;
		};
		let w = taskTargets('w');
		let pract = taskTargets('pract');
		let lb = taskTargets('lb');
		let p = taskTargets('p');
		let eng = taskTargets('eng');

		/// Return color depending on results:
		const colorize = function (left, rec) {
			let recLeft = left + rec;
			return (recLeft >= 0) ? ((left >= 0) ? targets.pendingColor : targets.recoveryColor) : targets.doneColor;
		};

		/// Loop through projects
		for (const value in data.groupOne) {
			let calc, content,
				frag = document.createDocumentFragment(),
				duration = data.groupOne[value].duration,
				time = durMinutes(duration);

			if (data.groupOne[value].name.includes('Ej')) {// Process Ej project
				const ejTR = getId('ej');
				calc = ej - time;

				content = [`${time}`, `${ej}\'`, `${calc}`];
				for (let i = 0, y = content.length, td; i < y; i++) {// Append content as td elements
					td = document.createElement('td');
					td.innerHTML = content[i];
					frag.appendChild(td);
				}
				ejTR.appendChild(frag);
				ejTR.setAttribute('title', `target + recovery: ${ej + targets.ej.recovery}`);

				ejTR.lastChild.style.color = colorize(calc, targets.ej.recovery);
			}
			else if (data.groupOne[value].name.includes('Lb')) {// Process Lbt project
				const lbTR = getId('lbt');
				calc = lbt - time;

				content = [`${time}`, `${lbt}\'`, `${calc}`];
				for (let x = 0, y = content.length, td; x < y; x++) {
					td = document.createElement("td");
					td.innerHTML = content[x];
					frag.appendChild(td);
				}
				lbTR.appendChild(frag);

				lbTR.lastChild.style.color = colorize(calc, 0);
			}
			else {// Process main project tasks

				const tasks = data.groupOne[value].children;
				let mainArr = ['pract', 'w', 'eng', 'p', 'lb'],
					contentArr = [],
					table = document.getElementById('table');

				/// Output function 

				const mainTask = function (task) {
					const taskTime = targets[task.name].default,
						time = durMinutes(task.duration) || 0;
					let tr = document.createElement('tr');

					calc = taskTime - time;
					content = [task.name, `${time}`, `${taskTime}`, `${calc}`];
					tr.className = "named";
					tr.setAttribute('title', `target + recovery: ${taskTime + targets[task.name].recovery}`);

					for (let i = 0, y = content.length, td; i < y; i++) {
						td = document.createElement('td');
						td.innerHTML = content[i];
						tr.appendChild(td);
					}
					tr.lastChild.style.color = colorize(calc, targets[task.name].recovery);

					let toContent = {};
					toContent.name = task.name;
					toContent.content = tr;
					contentArr.push(toContent);
				};

				/// Iterate over fetched main tasks and apply the output function

				for (let task of tasks) { mainTask(task); }

				/// Output main tasks for which there's no logged time yet

				mainArr.forEach(val => {
					let fetched = contentArr.map(a => a.name);
					if (fetched.includes(val)) {
						// console.log('fetched', val);
					} else {
						let dummyTask = { name: val, time: 0 };
						mainTask(dummyTask);
					}
				});

				/// Order output by ratio

				contentArr = contentArr.sort((a, b) => {
					return targets[b.name].ratio - targets[a.name].ratio;
				});

				// Add it to document fragment
				contentArr.forEach(element => {
					frag.appendChild(element.content);
				});

				/// Output content
				table.appendChild(frag);

			}
		}
		//__________________________________________________________________________

		/// Process total count

		const total = durHours(data.totals[0].totalTime),
			totalTar = targets.targetHours.default,
			listItem = document.createElement('li'),
			left = `<span id="totalLeft">${(totalTar - total).toFixed(2)}</span>`;

		listItem.innerHTML += `Total hours: ${total} &#183; Target: ${totalTar}-${totalTar + 10} &#183; Left: ${left}`;

		myList.appendChild(listItem);

		let totalLeft = document.getElementById('totalLeft');
		totalLeft.style.color = colorize((totalTar - total), targets.targetHours.max);

		//__________________________________________________________________________

	})
	.catch(function (error) {
		let p = document.createElement('p');
		p.appendChild(
			document.createTextNode('Error: ' + error.message)
		);
		document.body.insertBefore(p, myList);
	});
