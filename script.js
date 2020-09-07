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
let data, ej = targets.ej, w = targets.w.default, pract = targets.pract.default, lb = targets.lb.default, p = targets.p.default, eng = targets.eng.default, lbt = targets.lbt;
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

		// Redefine main target values according to defined ratios and to Lbt project if present (hardcoded lbDur)
		let lbDur = durMinutes(data.groupOne[1].duration); // duration in mins of lbt project
		if (lbDur > 1) {
			let ww = targets.workweek, entry = (val => targets[val].ratio);
			w = Math.round((ww - lbDur) * entry('w'));
			pract = Math.round((ww - lbDur) * entry('pract'));
			lb = Math.round((ww - lbDur) * entry('lb'));
			p = Math.round((ww - lbDur) * entry('p'));
			eng = Math.round((ww - lbDur) * entry('eng'));
		}

		// Loop through projects
		for (const value in data.groupOne) {
			if (data.groupOne[value].name.includes('Ej')) {// Process Ej project
				let ejTR = getId('ej');
				let duration = data.groupOne[value].duration;
				let time = durMinutes(duration);

				// todo: append children instead of innerHTML (performance)

				ejTR.innerHTML += `<td>${time}\'</td>`;
				ejTR.innerHTML += `<td>${ej}\'</td>`;
				ejTR.innerHTML += `<td>${ej - time}\'</td>`;

			}
			else if (data.groupOne[value].name.includes('Lb')) {// Process Lbt project
				let lbTR = getId('lbt');
				let duration = data.groupOne[value].duration;
				let time = durMinutes(duration);

				// todo: append children instead of innerHTML (performance)

				lbTR.innerHTML += `<td>${time}\'</td>`;
				lbTR.innerHTML += `<td>${lbt}\'</td>`;
				lbTR.innerHTML += `<td>${lbt - time}\'</td>`;
			}
			else {// Process main project tasks

				//output task names, and duration into a list
				let tasks = data.groupOne[value].children;

				for (let task of tasks) {
					let duration = data.groupOne[value].duration;
					let time = durMinutes(task.duration);
					let currEntry = task.name; //entry name

					let calc;
					switch (currEntry) {
						case 'w':
							calc = w - time; //compare to target
							main.parentElement.innerHTML += `<tr id="w">`;
							getId('w').innerHTML += `<td class="name">${currEntry}</td>`;
							getId('w').innerHTML += `<td>${time}\'</td>`;
							getId('w').innerHTML += `<td>${w}\'</td>`;
							getId('w').innerHTML += `<td>${w - time}\'</td>`;
							main.parentElement.innerHTML += '</tr>';
							break;
						case "pract":
							calc = pract - time;
							main.parentElement.innerHTML += `<tr id="pract">`;
							getId('pract').innerHTML += `<td class="name">${currEntry}</td>`;
							getId('pract').innerHTML += `<td>${time}\'</td>`;
							getId('pract').innerHTML += `<td>${pract}\'  (1440)</td>`;
							getId('pract').innerHTML += `<td>${pract - time}\'</td>`;
							main.parentElement.innerHTML += '</tr>';
							break;
						case 'lb':
							calc = lb - time;
							main.parentElement.innerHTML += `<tr id="lb">`;
							getId('lb').innerHTML += `<td class="name">${currEntry}</td>`;
							getId('lb').innerHTML += `<td>${time}\'</td>`;
							getId('lb').innerHTML += `<td>${lb}\'</td>`;
							getId('lb').innerHTML += `<td>${lb - time}\'</td>`;
							main.parentElement.innerHTML += '</tr>';
							break;
						case 'p':
							calc = p - time;
							main.parentElement.innerHTML += `<tr id="p">`;
							getId('p').innerHTML += `<td class="name">${currEntry}</td>`;
							getId('p').innerHTML += `<td>${time}\'</td>`;
							getId('p').innerHTML += `<td>${p}\'</td>`;
							getId('p').innerHTML += `<td>${p - time}\'</td>`;
							main.parentElement.innerHTML += '</tr>';
							break;
						case 'eng':
							calc = eng - time;
							main.parentElement.innerHTML += `<tr id="eng">`;
							getId('eng').innerHTML += `<td class="name">${currEntry}</td>`;
							getId('eng').innerHTML += `<td>${time}\'</td>`;
							getId('eng').innerHTML += `<td>${eng}\'</td>`;
							getId('eng').innerHTML += `<td>${eng - time}\'</td>`;
							main.parentElement.innerHTML += '</tr>';
							break;

						default:
							console.log('default');
							break;
					}
				}
			}

		}

		//________________________________________________________________________

		//process total count
		let total = durHours(data.totals[0].totalTime);
		let totalTar = 50;
		let listItem = document.createElement('li');

		listItem.innerHTML += `Total: ${total}, target: ${totalTar}, left: ${(totalTar - total).toFixed(2)}`;
		myList.appendChild(listItem);
		//__________________________________________________________________________

		/// Colorize background of progress (lastchild):

		let coll = document.querySelectorAll('tr');
		for (let tr of coll) {
			let lastChild = tr.lastChild;
			let num = parseInt(lastChild.textContent);

			if (Number.isInteger(num)) {

				if (num >= 0) {
					lastChild.style.color = 'red';
				}
				else { lastChild.style.color = 'green'; }

			}
		}

		//____________________________________________________________________________

	})
	.catch(function (error) {
		var p = document.createElement('p');
		p.appendChild(
			document.createTextNode('Error: ' + error.message)
		);
		document.body.insertBefore(p, myList);
	});
