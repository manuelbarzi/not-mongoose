module.exports = class CredentialsError extends Error {
    constructor(message) {
        super(message)

        Error.captureStackTrace(this, CredentialsError)

        this.name = CredentialsError.name
    }
}