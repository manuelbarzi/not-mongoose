module.exports = class ContentError extends Error {
    constructor(message) {
        super(message)

        Error.captureStackTrace(this, ContentError)

        this.name = ContentError.name
    }
}