const mongoose = require('.')
const { Schema, ObjectId, model } = mongoose
const path = require('path')
const assert = require('assert')

const User = model('User', new Schema({
	username: {
		type: String,
		required: true
	},
	password: {
		type: String,
		required: true
	},
	date: {
		type: Date
	}
}))

const Task = model('Task', new Schema({
	subject: {
		type: String,
		required: true
	},
	body: {
		type: String,
		required: true
	},
	date: {
		type: Date
	},
	status: {
		type: Number,
		default: 0
	},
	user: {
		type: ObjectId,
		required: true,
		ref: 'User'
	}
}))

	; (async () => {
		const connection = await mongoose.connect(path.join(__dirname, 'data'))

		await connection.dropDatabase()

		const user = new User({ username: 'peter', password: '123', date: new Date })

		assert(user._id instanceof ObjectId)
		assert.equal(user.username, 'peter')
		assert.equal(user.password, '123')
		assert(user.date instanceof Date)

		const user2 = await user.save()
		assert.deepEqual(user2, user)

		user2.username = 'petra'

		const user3 = await user2.save()
		assert.deepEqual(user3, user2)
		assert.deepEqual(user3, user)

		const user4 = await User.findById(user.id)
		assert.deepEqual(user4, user)

		const user5 = await User.findById('unexisting id')
		assert.equal(user5, null)

		const task = new Task({ subject: 'Hello, World!', body: 'blah blah blah', user: user._id })

		const task2 = await task.save()
		assert.deepEqual(task2, task)
		assert.equal(task2.user, user._id)

		const task3 = await task.populate('user')
		assert.deepEqual(task3, task)
		assert.deepEqual(task3.user, user.document)

		const user6 = await User.create({ username: 'john', password: '123', date: new Date })
		assert(user6._id instanceof ObjectId)
		assert.equal(user6.username, 'john')
		assert.equal(user6.password, '123')
		assert(user6.date instanceof Date)

		const users = await User.find({ password: '123' })
		assert.equal(users.length, 2)
		const [user7, user8] = users
		assert.deepEqual(user7, user)
		assert.deepEqual(user8, user6)

		const users2 = await User.find({ _id: user6._id })
		assert.equal(users2.length, 1)
		const [user9] = users2
		assert.deepEqual(user9, user6)

		const users3 = await User.find({ username: 'petra' })
		assert.equal(users3.length, 1)
		const [user10] = users3
		assert.deepEqual(user10, user)
	})()
		.catch(console.error)
		.finally(mongoose.disconnect)
