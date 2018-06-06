/*global jQuery, Handlebars, Router */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function (a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	var util = {
		uuid: function () {//used to assign each todo a unique id to be used with event handling
			/*jshint bitwise:false */
			var i, random;
			var uuid = '';

			for (i = 0; i < 32; i++) {
				random = Math.random() * 16 | 0;
				if (i === 8 || i === 12 || i === 16 || i === 20) {
					uuid += '-';
				}
				uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
			}

			return uuid;
		},
		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';// if count === 1, return word; else, return word+'s'
		},
		store: function (namespace, data) {//'todos-jquery', todos array
			if (arguments.length > 1) {//if passed both namespace and data, save
				return localStorage.setItem(namespace, JSON.stringify(data));//accesses localStorage, sets namespace key and data in string form
			} else {//if only passed namespace, get data
					var store = localStorage.getItem(namespace);//is there any data at this namespace?, unpack string passed as data with JSON
					return (store && JSON.parse(store)) || [];//if store is truthy, lets turn the data back into javascript item OR return empty array
			}																				 //if null return falsey
		}
	};

	var App = {
		init: function () {//
			this.todos = util.store('todos-jquery');//sets todos array equal to data from localStorage 'todos-jquery' namespace
			this.todoTemplate = Handlebars.compile(document.getElementById('todo-template').innerHTML);
			this.footerTemplate = Handlebars.compile(document.getElementById('footer-template').innerHTML);
			this.bindEvents();//sets up event listeners

			new Router({
				'/:filter': function (filter) {//<a href ='#/...'   ... will be passed through the given filter function
					this.filter = filter;
					this.render();
				}.bind(this)
			}).init('/all');
		},
		bindEvents: function () {
			var newTodo = document.getElementById('new-todo');
			newTodo.addEventListener('keyup', this.create.bind(this));

			var toggleAllButton = document.getElementById('toggle-all');
			toggleAllButton.addEventListener('change', this.toggleAll.bind(this));

			var footer = document.getElementById('footer');
			footer.addEventListener('click', function(event){
				if ( event.target.id === 'clear-completed'){
					App.destroyCompleted();
				}
			});

			var todoListElement = document.getElementById('todo-list');
			todoListElement.addEventListener('change', function(event){
				if ( event.target.className === 'toggle'){
					App.toggle(event);
				}});
			todoListElement.addEventListener('dblclick', function(event){
				if ( event.target.tagName === 'LABEL'){
					App.editingMode(event);
				}});
			todoListElement.addEventListener('keyup', function(event){
				if ( event.target.className === 'edit'){
					App.editKeyup(event);
				}});
			todoListElement.addEventListener('focusout', function(event){
				if ( event.target.className === 'edit'){
					App.update(event);
				}});
			todoListElement.addEventListener('click', function(event){
				if ( event.target.className === 'destroy'){
					App.destroy(event);
				}});
		},
		render: function () {
			var todos = this.getFilteredTodos();//gets todos based on filters applied
			//grabbing unordered list and injecting html into the unordered list
			var todoListElement = document.getElementById('todo-list');
			todoListElement.innerHTML = this.todoTemplate(todos)

			var main = document.getElementById('main');
			if (todos.length > 0){
				main.style.display = 'block';
			} else {
				main.style.display = 'none';
			};

			//sets property to boolean based on if active todos
			var toggleAllElement = document.getElementById('toggle-all');
				toggleAllElement.checked = (this.getActiveTodos().length === 0)

			this.renderFooter();//runs renderFooter function
			//places cursor back into new todo field
			var newTodo = document.getElementById('new-todo');
			newTodo.focus();

			util.store('todos-jquery', this.todos);//saves todos array @ 'todos-jquery'
		},
		renderFooter: function () {
			var todoCount = this.todos.length;//todocount === # of todos
			var activeTodoCount = this.getActiveTodos().length;//set # of active todos by viewing length of a active todos array
			var template = this.footerTemplate({//gives template data it needs to render onto the screen
				activeTodoCount: activeTodoCount,//changes dynamically
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),//pluralizes 'item' in footer
				completedTodos: todoCount - activeTodoCount,//tries to understand if there are any completed todos for 'clear completed' link
				filter: this.filter
			});

			var footer = document.getElementById('footer');
			if (todoCount > 0){
				footer.innerHTML = template;
				footer.style.display = 'block';
			} else {
				footer.style.display = 'none';
			};
		},
		toggleAll: function (event) {//receives event from event listener .on 'change'
			var isChecked = event.target.checked;//sets isChecked to event>target>'checked' boolean

			this.todos.forEach(function (todo) {//sets each item in todos completed property to isChecked boolean by forEach higherorder function
				todo.completed = isChecked;
			});

			this.render();
		},
		getActiveTodos: function () {//uses .filter to return a todos array of completed:false
			return this.todos.filter(function (todo) {
				return !todo.completed;
			});
		},
		getCompletedTodos: function () {//uses .filter to return a todos array of completed:true
			return this.todos.filter(function (todo) {
				return todo.completed;
			});
		},
		getFilteredTodos: function () {//if app.filter has been set to active, return a todos array of completed:false
			if (this.filter === 'active') {
				return this.getActiveTodos();
			}

			if (this.filter === 'completed') {//if app.filter has been set to active, return a todos array of completed:true
				return this.getCompletedTodos();
			}

			return this.todos;
		},
		destroyCompleted: function () {	// Removes completed todos by setting the todos array equal to a new filtered, completed-free todos array.
			this.todos = this.getActiveTodos();
			this.filter = 'all';
			this.render();
		},
		// accepts an element from inside the `.item` div and
		// returns the corresponding index in the `todos` array
		getIndexFromEl: function (el) {//

			var id = el.closest('li').getAttribute('data-id');
			var todos = this.todos;
			var i = todos.length;

			while (i--) {//while length of todos remains truthy
				if (todos[i].id === id) {//if id of todos array === id of captured event, return index
					return i;
				}
			}
		},
		create: function (event) {
			var input = event.target;//wraps the event in jQuery
			var val = input.value.trim();//returns value from event as string and trims whitespace. trim is a method on strings. '  d  '.trim() === 'd'

			if (event.key !== "Enter" || !val) {//if event.key is not 13 or nothing, then leave method
				return;
			}

			this.todos.push({//when press enter, skip if and push new todo object into todos array
				id: util.uuid(),
				title: val,
				completed: false
			});

			input.value = '';//clear input so field is blank

			this.render();//renders screen, now with new object
		},
		toggle: function (e) {//grabs id from an event, then !completed
			var i = this.getIndexFromEl(e.target);
			this.todos[i].completed = !this.todos[i].completed;
			this.render();
		},
		editingMode: function (event) {
			var input = event.target;

			this.forEachParentElement(input, function helper(element){
				if (element.tagName === 'LI'){
				element.className = 'editing';
				element.focus();
				};
			});

		},
		editKeyup: function (e) {
			if (e.which === ENTER_KEY) {//will only lose focus if enter key is hit
				e.target.blur();//blur means to take cursor out of the input
			}

			if (e.which === ESCAPE_KEY) {//when you press escape you dont want the data to be saved, which setting 'abort' to true accomplishes
				e.target.abort = true;
				e.target.blur();

			}
		},
		update: function (e) {
			var el = e.target;
			var val = el.value.trim();

			if (!val) {//if Boolean(!val) === true destroy element
				this.destroy(e);
				return;
			}

			if (el.abort) {
				el.abort = false;
			} else {
				this.todos[this.getIndexFromEl(el)].title = val;
			};

			this.render();
		},
		destroy: function (e) {
			this.todos.splice(this.getIndexFromEl(e.target), 1);
			this.render();
		},
		// cycles through DOM recursively
		forEachParentElement: function (element, callback) {
			callback(element);
			if (element.parentElement) {
					this.forEachParentElement(element.parentElement, callback);
			}
		}
	};

	App.init();

	});
