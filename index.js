const validate = require('./validate')
const fs = require('fs').promises

class Schema {
    constructor(rules) {
        this.rules = rules
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

const data = {}
let dataPath

module.exports = {
    Schema,

    ObjectId,

    model: function (name, schema) {
        validate.string(name)
        validate.string.notVoid('name', name)
        validate.instanceOf(Schema, schema)

        data[name] = []

        return class X {
            constructor(object) {
                for (const key in schema.rules) {
                    const rules = schema.rules[key]

                    if (rules.default != undefined) object[key] = rules.default

                    if (rules.required && object[key] == undefined) throw Error(`${key} is required but not present`)

                    if (object[key] != undefined && object[key].constructor !== rules.type) throw Error(`${key} is not of type ${rules.type}`)
                }

                if (!object._id)
                    object._id = new ObjectId(`${Date.now()}`)

                this.object = object

                Object.defineProperty(this, '_id', {
                    set(value) {
                        this.object._id = value
                    },

                    get() {
                        return this.object._id
                    }
                })

                for (const key in schema.rules) {
                    Object.defineProperty(this, key, {
                        set(value) {
                            this.object[key] = value
                        },

                        get() {
                            return this.object[key]
                        }
                    })
                }
            }

            async save() {
                const index = data[name].findIndex(({ _id }) => _id.toString() === this.object._id.toString())

                if (index < 0)
                    data[name].push({ ...this.object })
                else
                    data[name][index] = { ...this.object }

                await fs.writeFile(`${dataPath}/${name}.json`, JSON.stringify(data[name], null, 4))

                return this
            }

            static findById(id) {
                return new X({ ...data[name].find(object => object._id.toString() === id) })
            }

            get id() {
                return this.object._id.toString()
            }

            static get name() {
                return name
            }

            populate(key) {
                const rules = schema.rules[key]

                if (rules && rules.ref) {
                    const values = data[rules.ref]

                    if (values && values.length) {
                        const value = values.find(({ _id }) => _id.toString() === this[key].toString())

                        this[key] = { ...value }
                    }
                }
            }
        }
    },

    async connect(path = '.') {
        dataPath = path

        for (const key in data) {
            const path = `${dataPath}/${key}.json`
            try {
                await fs.access(path)

                data[key] = JSON.parse(await fs.readFile(path))
            } catch (error) {
                // noop
            }
        }
    }
}