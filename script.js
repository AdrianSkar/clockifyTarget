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
	style = document.getElementsByTagName('style')[0];

// Get data from Clockify for our time range
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
		/// Redefine main target values according to defined ratios (creds.js)
		//  and to Lbt/main projects if present.
		let mainTime = 0;
		for (let entry of data.groupOne) {
			if (entry.clientName.includes('main')) {
				mainTime += durMinutes(entry.duration);
			}
		}

		// Vars outside loops
		let ww = targets.workweek.default,
			side_pract,
			total_main = 0,
			lb_main = 0;

		const taskTargets = function (val) {
			if (mainTime > 0) {
				// If there's record of main tasks; calculate accordingly
				return Math.round((ww - mainTime) * targets[val].ratio);
			} // If mainTime surpasses workweek set to 0, otherwise load defaults
			return mainTime >= ww ? 0 : Math.round(ww * targets[val].ratio);
		};
		const mainTasks = {
			w: taskTargets('w'),
			pract: taskTargets('pract'),
			p: taskTargets('p'),
			eng: taskTargets('eng'),
		};

		/// Return color depending on results:
		const colorize = function (left, rec) {
			let recLeft = left + rec;
			return recLeft >= 0
				? left >= 0
					? 'var(--pending-color)'
					: 'var(--recovery-color)'
				: 'var(--done-color)';
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

		//__________________________________________________________________________

		/// Loop through projects
		for (const value in data.groupOne) {
			let calc,
				content,
				frag = document.createDocumentFragment(),
				project = data.groupOne[value],
				time = durMinutes(project.duration);
			// Ej_____________________________________________________________________
			if (project.name.includes('Ej')) {
				// Process Ej project
				const ejTR = getId('ej');
				calc = ej - time;
				content = [`${time}`, `${ej}`, `${calc}`];
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
					width: ${percentageDone('ej', time, ej)}%;
					background-color: ${colorize(calc, targets.ej.recovery)};
				}
				`;
				document.head.appendChild(style);
			}
			// Lb_____________________________________________________________________
			else if (project.clientName.includes('Lb')) {
				// Just account for times and later use them on Main
				total_main += time;
				lb_main += time;
			}
			// Side_main______________________________________________________________
			else if (project.clientName.includes('main')) {
				//* Process freelance/side projects that count as main time (total hs/recovery calc).
				total_main += time;
			}
			// Side_pract_____________________________________________________________
			else if (project.clientName.includes('pract')) {
				//* Process freelance/side projects related to pract as 'pract' next.
				side_pract += time;
			}

			// Rest___________________________________________________________________
			else {
				//* Process main project tasks
				const tasks = data.groupOne[value].children;
				let mainArr = ['pract', 'w', 'eng', 'p'],
					contentArr = [],
					table = document.getElementById('table');
				// let perDone = Math.round((time * 100) / (taskTime + targets[task.name].recovery));

				/// Output function

				const mainTask = function (task) {
					const taskTime = mainTasks[task.name];
					let time = durMinutes(task.duration) || 0,
						recovery = targets[task.name] ? targets[task.name].recovery : 0;
					if (task.name === 'pract') {
						// Include side_pract times into 'pract'
						time += side_pract ? side_pract : 0;
					}
					let tr = document.createElement('tr');

					calc = taskTime - time;
					content = [task.name, `${time}`, `${taskTime}`, `${calc}`];
					tr.className = `named bars ${task.name}`;

					// progress bar
					style.innerHTML += `
					.${task.name}::after {
						width: ${percentageDone(task.name, time, taskTime)}%;
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
					// tr.lastChild.style.color = colorize(calc, recovery);
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

				contentArr.sort((a, b) => {
					if (targets[a.name] && targets[b.name]) {
						return targets[b.name].ratio - targets[a.name].ratio;
					} else {
						return a.name.localeCompare(b.name);
					}
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

		/// Process total main count

		const mainTR = getId('main');

		let mainContent = [
				`${total_main}`,
				`${lb_main}`,
				`${targets.workweek.default - total_main}`,
			],
			fragMain = document.createDocumentFragment();
		for (let x = 0, y = mainContent.length, td; x < y; x++) {
			td = document.createElement('td');
			td.innerHTML = mainContent[x];
			fragMain.appendChild(td);
		}
		mainTR.appendChild(fragMain);

		// Color Lb/T time for min hours
		mainTR.children[1].style.color = colorize(targets.lbt - lb_main, 0);
		// Color time left for all main entries
		mainTR.lastChild.style.color = colorize(
			targets.workweek.default - total_main,
			0
		);

		//______________________________________________________________________________

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
