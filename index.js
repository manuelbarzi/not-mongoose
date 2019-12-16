const validate = require('./validate')
const fs = require('fs').promises
const path = require('path')
const uuid = require('uuid/v4')

class Schema {
	constructor(properties) {
		this.properties = properties
	}
}

class ObjectId {
	constructor(id) {
		this.value = id
	}

	toString() {
		return this.value.toString()
	}
}

const collections = {}
let database

module.exports = {
	Schema,

	ObjectId,

	model: function (name, schema) {
		validate.string(name)
		validate.string.notVoid('name', name)
		validate.instanceOf(Schema, schema)

		collections[name] = []

		return class Model {
			constructor(document) {
				for (const property in schema.properties) {
					const rules = schema.properties[property]

					if (rules.default != undefined) document[property] = rules.default

					if (rules.required && document[property] == undefined) throw Error(`${property} is required but not present`)

					if (document[property] != undefined && document[property].constructor !== rules.type) throw Error(`${property} is not of type ${rules.type}`)
				}

				if (!document._id)
					document._id = new ObjectId(uuid())

				this.document = document

				Object.defineProperty(this, '_id', {
					set(value) {
						this.document._id = value
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

			async save() {
				const collection = collections[name]

				const index = collection.findIndex(({ _id }) => _id.toString() === this.document._id.toString())

				if (index < 0)
					collection.push({ ...this.document })
				else
					collection[index] = { ...this.document }

				await fs.writeFile(path.join(database, `${name}.json`), JSON.stringify(collection, null, 4))

				return this
			}

			static findById(id) {
				return new Model({ ...collections[name].find(object => object._id.toString() === id) })
			}

			get id() {
				return this.document._id.toString()
			}

			static get name() {
				return name
			}

			populate(property) {
				const properties = schema.properties[property]

				if (properties && properties.ref) {
					const collection = collections[properties.ref]

					if (collection && collection.length) {
						const document = collection.find(({ _id }) => _id.toString() === this[property].toString())

						this[property] = { ...document }
					}
				}
			}
		}
	},

	async connect(folder = '.') {
		database = folder

		for (const name in collections) {
			const file = path.join(database, `${name}.json`)

			try {
				await fs.access(file)

				collections[name] = JSON.parse(await fs.readFile(file))
			} catch (error) {
				// noop
			}
		}
	}
}
