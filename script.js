import { creds, targets } from './creds.js'; // Credentials for the api

var myList = document.querySelector('ul');

/// Dates to pass on to the request (start and end as ISO strings):

// let today = new Date();

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
			],

			// SETTINGS (OPTIONAL)
			"sortColumn": "duration",
			// FILTERS (OPTIONAL)

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
		// console.log('ok:', json);
		data = json;

		/// Redefine main target values according to defined ratios and to Lbt project if present (hardcoded lbDur)
		let lbDur = durMinutes(data.groupOne[1].duration); // duration in mins of lbt project
		if (lbDur > 1) {
			let ww = targets.workweek, entry = (val => targets[val].ratio);
			w = Math.round((ww - lbDur) * entry('w'));
			pract = Math.round((ww - lbDur) * entry('pract'));
			lb = Math.round((ww - lbDur) * entry('lb'));
			p = Math.round((ww - lbDur) * entry('p'));
			eng = Math.round((ww - lbDur) * entry('eng'));
		}

		/// Add color depending on results:
		let colorize = function (left, rec) {
			let recLeft = left + rec;
			return (recLeft >= 0) ? ((left >= 0) ? targets.pendingColor : targets.recoveryColor) : targets.doneColor;

			// Checking for left first
			// console.log('left: ', left, 'rec:', rec);
			// return (left >= 0) ? targets.pendingColor : (left + rec >= 0) ? targets.recoveryColor : targets.doneColor;
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
				for (let i = 0, y = content.length; i < y; i++) {
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

				for (let task of tasks) {
					let duration = data.groupOne[value].duration;
					let time = durMinutes(task.duration);

					let table = document.getElementById('table');
					// let mainTR = document.getElementById('main');
					let frag = document.createDocumentFragment();
					let tr = document.createElement('tr');

					let content;
					switch (task.name) {
						case 'w':
							calc = w - time; //compare to target
							content = [task.name, `${time}`, `${w}`, `${calc}`];
							tr = document.createElement('tr');
							tr.className = "named";
							tr.setAttribute('title', `target + recovery: ${w + targets.w.recovery}`);

							for (let i = 0, y = content.length; i < y; i++) {
								let td = document.createElement('td');
								td.innerHTML = content[i];
								tr.appendChild(td);
							}
							tr.lastChild.style.color = colorize(calc, targets[task.name].recovery);

							frag.appendChild(tr);
							break;

						case "pract":
							calc = pract - time;
							content = [task.name + '<sup>r</sup>', `${time}`, `${pract}`, `${calc}`];
							tr = document.createElement('tr');
							tr.className = "named";
							tr.setAttribute('title', `target + recovery: ${pract + targets.pract.recovery}`);

							for (let i = 0, y = content.length; i < y; i++) {
								let td = document.createElement('td');
								td.innerHTML = content[i];
								tr.appendChild(td);
							}
							tr.lastChild.style.color = colorize(calc, targets[task.name].recovery);

							frag.appendChild(tr);
							break;

						case 'lb':
							calc = lb - time;
							content = [task.name, `${time}`, `${lb}`, `${calc}`];
							tr = document.createElement('tr');
							tr.className = "named";
							tr.setAttribute('title', `target + recovery: ${lb + targets.lb.recovery}`);

							for (let i = 0, y = content.length; i < y; i++) {
								let td = document.createElement('td');
								td.innerHTML = content[i];
								tr.appendChild(td);
							}
							tr.lastChild.style.color = colorize(calc, targets[task.name].recovery);

							frag.appendChild(tr);

							break;
						case 'p':
							calc = p - time;
							content = [task.name, `${time}`, `${p}`, `${calc}`];
							tr = document.createElement('tr');
							tr.className = "named";
							tr.setAttribute('title', `target + recovery: ${p + targets.p.recovery}`);

							for (let i = 0, y = content.length; i < y; i++) {
								let td = document.createElement('td');
								td.innerHTML = content[i];
								tr.appendChild(td);
							}
							tr.lastChild.style.color = colorize(calc, targets[task.name].recovery);

							frag.appendChild(tr);

							break;
						case 'eng':
							calc = eng - time;
							content = [task.name, `${time}`, `${eng}`, `${calc}`];
							tr = document.createElement('tr');
							tr.className = "named";
							tr.setAttribute('title', `target + recovery: ${eng + targets.eng.recovery}`);

							for (let i = 0, y = content.length; i < y; i++) {
								let td = document.createElement('td');
								td.innerHTML = content[i];
								tr.appendChild(td);
							}
							tr.lastChild.style.color = colorize(calc, targets[task.name].recovery);

							frag.appendChild(tr);

							break;

						default:
							console.log('default');
							break;
					}

					table.appendChild(frag); // This way we only insert content once instead of doing it for every entry.

				}
			}

		}

		//__________________________________________________________________________

		/// Process total count

		let total = durHours(data.totals[0].totalTime);
		let totalTar = targets.targetHours;
		let listItem = document.createElement('li');
		let left = `<span id="totalLeft">${(totalTar - total).toFixed(2)}</span>`;

		listItem.innerHTML += `Total: ${total} | Target: ${totalTar}-${totalTar + 10} | Left: ${left}`;

		myList.appendChild(listItem);

		let totalLeft = document.getElementById('totalLeft');
		totalLeft.style.color = (totalTar - total > 1) ? targets.pendingColor : targets.doneColor;

		//__________________________________________________________________________

	})
	.catch(function (error) {
		var p = document.createElement('p');
		p.appendChild(
			document.createTextNode('Error: ' + error.message)
		);
		document.body.insertBefore(p, myList);
	});
