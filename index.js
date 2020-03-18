const fs = require('fs').promises
const path = require('path')
const uuid = require('uuid/v4')

let connection
const schemas = {}
const collections = {}

class Schema {
	constructor(properties) {
		this.properties = properties
	}
}

class ObjectId {
	constructor(value) {
		if (typeof value === 'string') {
			if (!value.trim().length) throw new Error('value is empty or blank')

			this.value = value
		} else {
			if (value.constructor !== Object) throw new Error(`${value} is not a plain object`)
			if (typeof value.value !== 'string') throw new TypeError(`${value.value} is not a string`)
			if (!value.value.trim().length) throw new Error('value is empty or blank')

			this.value = value.value
		}

	}

	toString() {
		return this.value
	}
}

class Connection {
	constructor(uri) {
		this.uri = uri

		return this.get()
	}

	async get() {
		const { uri } = this

		try {
			await fs.access(uri)
		} catch (error) {
			await fs.mkdir(uri, { recursive: true })
		}

		for (const name in collections) {
			let collection = collections[name]

			if (!collection) {
				try {
					const file = path.join(uri, `${name}.json`)

					await fs.access(file)

					collection = collections[name] = JSON.parse(await fs.readFile(file))
				} catch (error) {
					// noop
				}

				if (collection) {
					const schema = schemas[name]

					collection.forEach(document => {
						document._id = new ObjectId(document._id.value)

						for (const property in schema.properties) {
							const rules = schema.properties[property]

							if (rules.type !== String && rules.type !== Number && rules.type !== Boolean)
								document[property] = new rules.type(document[property])
						}
					})
				} else collections[name] = []
			}
		}

		return this
	}

	async dropDatabase() {
		const { uri } = this

		try {
			await fs.access(uri)
			await fs.rmdir(uri, { recursive: true })

			for (const name in collections) {
				collections[name] = null
			}
		} catch (error) {
			debugger
			// noop
		}
	}
}

module.exports = {
	Schema,

	ObjectId,

	async connect(uri = '.') {
		return connection = await new Connection(uri)
	},

	model(name, schema) {
		if (typeof name !== 'string') throw new TypeError(`name ${name} is not a string`)
		if (!name.trim().length) throw new Error('name is empty or blank')
		if (!(schema instanceof Schema)) throw new TypeError(`schema is not an instance of Schema`)

		schemas[name] = schema
		collections[name] = null

		return class Model {
			constructor(document) {
				if (!document._id)
					document._id = new ObjectId(uuid())

				for (const property in schema.properties) {
					const rules = schema.properties[property]

					if (rules.default != undefined) document[property] = rules.default

					if (rules.required && document[property] == undefined) throw Error(`${property} is required but not present`)

					if (document[property] != undefined && document[property].constructor !== rules.type) throw Error(`${property} is not of type ${rules.type}`)
				}

				this.document = document

				Object.defineProperty(this, '_id', {
					set(_id) {
						this.document._id = _id
					},

					get() {
						return this.document._id
					}
				})

				for (const property in schema.properties) {
					Object.defineProperty(this, property, {
						set(value) {
							this.document[property] = value
						},

						get() {
							return this.document[property]
						}
					})
				}
			}

			static async create(document) {
				return new Model(document).save()
			}

			async save() {
				connection = await connection.get()

				const collection = collections[name]

				const index = collection.findIndex(({ _id }) => _id.toString() === this.document._id.toString())

				const _document = { ...this.document }

				if (index < 0)
					collection.push(_document)
				else
					collection[index] = _document

				const { uri } = connection

				await fs.writeFile(path.join(uri, `${name}.json`), JSON.stringify(collection, null, 4))

				return this
			}

			static async findById(id) {
				const document = collections[name].find(document => document._id.toString() === id)

				return document ? new Model({ ...document }) : null
			}

			static async find(filter) {
				const documents = collections[name].filter(document => {
					const keys = Object.keys(filter)
					let match = true

					for (let i = 0; i < keys.length && match; i++) {
						const key = keys[i]

						if (key == '_id') match = filter._id.toString() === document._id.toString()
						else match = filter[key] === document[key]
					}

					return match
				})

				return documents.map(document => new Model({ ...document }))
			}

			get id() {
				return this.document._id.toString()
			}

			static get name() {
				return name
			}

			async populate(property) {
				const properties = schema.properties[property]

				if (properties && properties.ref) {
					const collection = collections[properties.ref]

					if (collection && collection.length) {
						const document = collection.find(({ _id }) => _id.toString() === this[property].toString())

						this[property] = { ...document }
					}
				}

				return this
			}
		}
	},

	async disconect() {
		// noop
	}
}
