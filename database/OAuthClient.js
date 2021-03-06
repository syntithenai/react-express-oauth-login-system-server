const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const OAuthClientSchema = new Schema({
  clientName: String,
  website_url: String,
  clientBy: String,
  clientId: String,
  clientSecret: String,
  redirectUris: {
    type: [String]
  },
  grants: {
    type: [String],
    default: ['authorization_code', 'password', 'refresh_token', 'client_credentials']
  },
  scope: String,
  user: { type: Schema.Types.ObjectId, ref: 'User' }
});
OAuthClientSchema.virtual('id').get(function () {
  return this._id;
});
module.exports = mongoose.model('OAuthClient', OAuthClientSchema);
