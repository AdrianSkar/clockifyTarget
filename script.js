import { creds, targets } from './creds.js'; // Credentials for the api

var myList = document.querySelector('ul');

/// Dates to pass on to the request (start and end as ISO strings):

let getMonday = () => {
	const d = new Date(),
		day = d.getDay();
	// calculate the day to set as monday (0)
	const diff = d.getDate() - day + (day === 0 ? -6 : 1); //adjust for sundays
	return new Date(d.setDate(diff));
};

let monday = getMonday();

let start = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0)).toISOString(); // Mon, 00:00:00 (UTC/ISO)

let today = new Date();
let end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)).toISOString(); // Today, 23:59:59 (UTC/ISO)

///___________________________________________________________________________

// Time conversion functions
let durMinutes = val => Math.round(val / 60);
let durHours = val => (val / 3600).toFixed(2);

let getId = val => document.getElementById(val);

// Variables holding fetched data and default target times
let data, ej = targets.ej.default, w = targets.w.default, pract = targets.pract.default, lb = targets.lb.default, p = targets.p.default, eng = targets.eng.default, lbt = targets.lbt;
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
	.then(function (json) {
		console.log('ok:', json);
		data = json;

		/// Redefine main target values according to defined ratios (creds.js) and to Lbt project if present (hardcoded lbDur)
		let lbDur = durMinutes(data.groupOne[1].duration); // duration in mins of lbt project
		if (lbDur > 0) {
			let ww = targets.workweek, entry = (val => targets[val].ratio);
			w = Math.round((ww - lbDur) * entry('w'));
			pract = Math.round((ww - lbDur) * entry('pract'));
			lb = Math.round((ww - lbDur) * entry('lb'));
			p = Math.round((ww - lbDur) * entry('p'));
			eng = Math.round((ww - lbDur) * entry('eng'));
		}

		/// Return color depending on results:
		let colorize = function (left, rec) {
			let recLeft = left + rec;
			return (recLeft >= 0) ? ((left >= 0) ? targets.pendingColor : targets.recoveryColor) : targets.doneColor;
		};

		/// Loop through projects
		for (const value in data.groupOne) {
			let calc, content;
			if (data.groupOne[value].name.includes('Ej')) {// Process Ej project
				let ejTR = getId('ej');
				let frag = document.createDocumentFragment();

				let duration = data.groupOne[value].duration;
				let time = durMinutes(duration);
				calc = ej - time;

				content = [`${time}`, `${ej}\'`, `${calc}`];
				for (let i = 0, y = content.length; i < y; i++) {//append content as td elements
					let td = document.createElement('td');
					td.innerHTML = content[i];
					frag.appendChild(td);
				}
				ejTR.appendChild(frag);
				ejTR.setAttribute('title', `target + recovery: ${ej + targets.ej.recovery}`);

				ejTR.lastChild.style.color = colorize(calc, targets.ej.recovery);
			}
			else if (data.groupOne[value].name.includes('Lb')) {// Process Lbt project
				let lbTR = getId('lbt');
				let frag = document.createDocumentFragment();

				let duration = data.groupOne[value].duration;
				let time = durMinutes(duration);
				calc = lbt - time;

				content = [`${time}`, `${lbt}\'`, `${calc}`];
				for (let x = 0, y = content.length; x < y; x++) {
					let td = document.createElement("td");
					td.innerHTML = content[x];
					frag.appendChild(td);
				}
				lbTR.appendChild(frag);

				lbTR.lastChild.style.color = colorize(calc, 0);
			}
			else {// Process main project tasks

				//output task names, and duration into a list
				let tasks = data.groupOne[value].children;
				let mainArr = ['pract', 'w', 'eng', 'p', 'lb'];

				let contentArr = [], tasksArr = [];
				let table = document.getElementById('table');
				let frag = document.createDocumentFragment();
				let tr = document.createElement('tr');

				let content;
				let duration = data.groupOne[value].duration;


				///output function 

				const mainTask = function (task) {
					let taskTime = targets[task.name].default;
					let time = durMinutes(task.duration) || 0;

					calc = taskTime - time;
					content = [task.name, `${time}`, `${taskTime}`, `${calc}`];
					tr = document.createElement('tr');
					tr.className = "named";
					tr.setAttribute('title', `target + recovery: ${taskTime + targets[task.name].recovery}`);

					for (let i = 0, y = content.length; i < y; i++) {
						let td = document.createElement('td');
						td.innerHTML = content[i];
						tr.appendChild(td);
					}
					tr.lastChild.style.color = colorize(calc, targets[task.name].recovery);

					let toContent = {};
					toContent.name = task.name;
					toContent.content = tr;
					contentArr.push(toContent);
				};
				//____________________________________________________________________

				for (let task of tasks) {
					mainTask(task);
				}
				//______________________________________________________________________

				console.log(contentArr);

				/// Output main tasks for which there's no logged time yet
				mainArr.forEach(val => {
					let dummy = contentArr.map(a => a.name);
					if (dummy.includes(val)) {
						console.log('fetched', val);
					} else {
						let dummyTask = { name: val, time: 0 };
						mainTask(dummyTask);
						console.log(val);
					}
				});


				/// Order output by ratio
				contentArr = contentArr.sort((a, b) => {
					return targets[b.name].ratio - targets[a.name].ratio;
				});

				//add it to document fragment
				contentArr.forEach(element => {
					frag.appendChild(element.content);
				});

				table.appendChild(frag); // output content

			}

		}

		//__________________________________________________________________________

		/// Process total count

		let total = durHours(data.totals[0].totalTime);
		let totalTar = targets.targetHours.default;
		let listItem = document.createElement('li');
		let left = `<span id="totalLeft">${(totalTar - total).toFixed(2)}</span>`;

		listItem.innerHTML += `Total: ${total} | Target: ${totalTar}-${totalTar + 10} | Left: ${left}`;

		myList.appendChild(listItem);

		let totalLeft = document.getElementById('totalLeft');

		totalLeft.style.color = colorize((totalTar - total), targets.targetHours.max);
		// totalLeft.style.color = (totalTar - total > 1) ? targets.pendingColor : targets.doneColor;

		//__________________________________________________________________________

	})
	.catch(function (error) {
		var p = document.createElement('p');
		p.appendChild(
			document.createTextNode('Error: ' + error.message)
		);
		document.body.insertBefore(p, myList);
	});
