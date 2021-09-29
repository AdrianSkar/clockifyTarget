import { creds, targets } from './creds.js'; // Credentials for the api (not recommended; currently trying to implement .env or similar approach)

/// Dates to pass on to the request (start and end as ISO strings):

const getMonday = () => {
	const d = new Date(),
		day = d.getDay();
	// calculate the day to set as Monday (0)
	const diff = d.getDate() - day + (day === 0 ? -6 : 1); //adjust for Sundays
	return new Date(d.setDate(diff));
};

const monday = getMonday(),
	start = new Date(
		Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0)
	).toISOString(); // Mon, 00:00:00 (UTC/ISO)

const today = new Date(),
	end = new Date(
		Date.UTC(
			today.getFullYear(),
			today.getMonth(),
			today.getDate(),
			23,
			59,
			59,
			999
		)
	).toISOString(); // Today, 23:59:59 (UTC/ISO)

/// Add week number to page title
// https://weeknumber.net/how-to/javascript

Date.prototype.getWeek = function () {
	var date = new Date(this.getTime());
	date.setHours(0, 0, 0, 0);
	// Thursday in current week decides the year.
	date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
	// January 4 is always in week 1.
	var week1 = new Date(date.getFullYear(), 0, 4);
	// Adjust to Thursday in week 1 and count number of weeks from date to week1.
	const result =
		1 +
		Math.round(
			((date.getTime() - week1.getTime()) / 86400000 -
				3 +
				((week1.getDay() + 6) % 7)) /
				7
		);
	return result.toString().padStart(2, '0');
};
document.querySelector('h1').textContent += ` (${today
	.getFullYear()
	.toString()
	.slice(2)}${today.getWeek()})`;

//______________________________________________________________________________

const durMinutes = val => Math.round(val / 60),
	durHours = val => (val / 3600).toFixed(2),
	getId = val => document.getElementById(val);
let myList = document.querySelector('ul'),
	// Variables holding fetched data and default target times
	ej = targets.ej.default,
	lbt = targets.lbt,
	style = document.getElementsByTagName('style')[0];
fetch(
	`https://reports.api.clockify.me/v1/workspaces/${creds.workspace}/reports/summary`,
	{
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'X-Api-Key': `${creds.apiKey}`,
		},
		body: JSON.stringify({
			dateRangeStart: start,
			dateRangeEnd: end,
			summaryFilter: {
				groups: ['project', 'timeentry'],
			},
		}),
	}
)
	.then(function (response) {
		if (!response.ok) {
			throw new Error('HTTP error, status = ' + response.status);
		}
		return response.json();
	})
	.then(function (data) {
		// console.log('ok:', data);

		/// Redefine main target values according to defined ratios (creds.js) and to Lbt project if present

		let lbtDur;
		for (let entry of data.groupOne) {
			if (entry.name.includes('Lb')) {
				lbtDur = durMinutes(entry.duration); // Duration in mins of lbt project
			}
			break;
		}
		let ww = targets.workweek.default,
			side,
			side_pract;

		const taskTargets = function (val) {
			if (lbtDur > 0) {
				// If there's record of lbt; calculate accordingly
				return Math.round((ww - lbtDur) * targets[val].ratio);
			} // If lbtDur surpasses workweek set to 0, otherwise load defaults
			return lbtDur >= ww ? 0 : Math.round(ww * targets[val].ratio);
		};
		const mainTasks = {
			w: taskTargets('w'),
			pract: taskTargets('pract'),
			lb: taskTargets('lb'),
			p: taskTargets('p'),
			eng: taskTargets('eng'),
		};

		/// Return color depending on results:
		const colorize = function (left, rec) {
			let recLeft = left + rec;
			return recLeft >= 0
				? left >= 0
					? targets.pendingColor
					: targets.recoveryColor
				: targets.doneColor;
		};

		//______________________________________________________________________________

		/// Calculate % done
		let percentageDone = (taskName, time, taskTime) => {
			// Calculate progress if entry exits on `targets`
			if (targets[taskName]) {
				let value = Math.round(
					(time * 100) / (taskTime + targets[taskName].recovery)
				);
				if (taskTime + targets[taskName].recovery < 0) {
					return 100;
				}
				return value > 0 ? (value > 100 ? 100 : value) : 0;
			} else {
				// Otherwise treat it as side project -> 100
				return 100;
			}
		};

		//______________________________________________________________________________

		/// Loop through projects
		for (const value in data.groupOne) {
			let calc,
				content,
				frag = document.createDocumentFragment(),
				duration = data.groupOne[value].duration,
				time = durMinutes(duration);

			if (data.groupOne[value].name.includes('Ej')) {
				//* Process Ej project
				const ejTR = getId('ej');
				calc = ej - time;
				content = [`${time}`, `${ej}\'`, `${calc}`];
				for (let i = 0, y = content.length, td; i < y; i++) {
					// Append content as td elements
					td = document.createElement('td');
					td.innerHTML = content[i];
					frag.appendChild(td);
				}
				ejTR.appendChild(frag);
				ejTR.setAttribute(
					'title',
					`target + recovery: ${ej + targets.ej.recovery}`
				);
				ejTR.lastChild.style.color = colorize(calc, targets.ej.recovery);

				// progress bar
				ejTR.className = 'named bars';
				style.innerHTML += `
				#ej::after {
					width: ${percentageDone('ej', time, ej)}% !important;
					background-color: ${colorize(calc, targets.ej.recovery)};
				}
				`;
				document.head.appendChild(style);
				//______________________________________________________________________
			} else if (data.groupOne[value].name.includes('Lb')) {
				//* Process Lbt project
				const lbTR = getId('lbt');
				calc = lbt - time;

				content = [`${time}`, `${lbt}\'`, `${calc}`];
				for (let x = 0, y = content.length, td; x < y; x++) {
					td = document.createElement('td');
					td.innerHTML = content[x];
					frag.appendChild(td);
				}
				lbTR.appendChild(frag);

				lbTR.lastChild.style.color = colorize(calc, 0);

				// progress bar
				let percentageLBT = (time, taskTime) => {
					// redefined because lbt doesn't require recovery
					let value = Math.round((time * 100) / taskTime);
					return value > 0 ? (value > 100 ? 100 : value) : 0;
				};

				lbTR.className = 'named bars';
				style.innerHTML += `
								#lbt::after {
									width: ${percentageLBT(time, lbt)}% !important;
									background-color: ${colorize(calc, 0)};
								}
								`;
				document.head.appendChild(style);
				//______________________________________________________________________
			} else if (data.groupOne[value].name.includes('side_pract')) {
				// Process freelance/side projects related to pract as 'pract' next.
				console.log('entry', data.groupOne[value]);
				side_pract = time;
			} else {
				//* Process main project tasks
				const tasks = data.groupOne[value].children;
				let mainArr = ['pract', 'w', 'eng', 'p', 'lb'],
					contentArr = [],
					table = document.getElementById('table');
				// let perDone = Math.round((time * 100) / (taskTime + targets[task.name].recovery));

				/// Output function

				const mainTask = function (task) {
					const taskTime = mainTasks[task.name]; //  "|| targets[task.name].default" removed: default is already assign on mainTasks
					let time = durMinutes(task.duration) || 0,
						recovery = targets[task.name] ? targets[task.name].recovery : 0;
					if (task.name === 'pract') {
						// Include freelance time to 'pract'
						time += side_pract ? side_pract : 0;
					}
					let tr = document.createElement('tr');

					calc = taskTime - time;
					content = [task.name, `${time}`, `${taskTime}`, `${calc}`];
					tr.className = `named bars ${task.name}`;

					// progress bar
					style.innerHTML += `
					.${task.name}::after {
						width: ${percentageDone(task.name, time, taskTime)}% !important;
						background-color: ${colorize(calc, recovery)};
					}
					`;
					document.head.appendChild(style);
					//______________________________________________________________________

					tr.setAttribute('title', `target + recovery: ${taskTime + recovery}`);

					for (let i = 0, y = content.length, td; i < y; i++) {
						td = document.createElement('td');
						td.innerHTML = content[i];
						tr.appendChild(td);
					}
					tr.lastChild.style.color = colorize(calc, recovery);

					let toContent = {};
					toContent.name = task.name;
					toContent.content = tr;
					contentArr.push(toContent);
				};
				/// Iterate over fetched main tasks and apply the output function

				for (let task of tasks) {
					mainTask(task);
				}

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

		const targetHours = Math.round((ww + ej) / 60), //ej project is counted apart from main ones
			maxHours = Math.round(targetHours * targets.workweek.maxRatio),
			total = durHours(data.totals[0].totalTime),
			listItem = document.createElement('li'),
			left = `<span id="totalLeft">${(targetHours - total).toFixed(2)}</span>`;

		listItem.innerHTML += `Total hours: ${total} &#183; Target: ${targetHours}-${maxHours} &#183; Left: ${left}`;

		myList.appendChild(listItem);

		let totalLeft = document.getElementById('totalLeft');
		totalLeft.style.color = colorize(
			targetHours - total,
			maxHours - targetHours
		);

		//__________________________________________________________________________
	})
	.catch(function (error) {
		let p = document.createElement('p');
		p.appendChild(document.createTextNode('Error: ' + error.message));
		console.error(error);
		document.body.insertBefore(p, myList);
	});
