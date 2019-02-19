import { authWithHeaders } from '../../middlewares/auth';
import { chatReporterFactory } from '../../libs/chatReporting/chatReporterFactory';
import { model as User } from '../../models/user';

let api = {};

/**
 * @api {post} /api/v4/members/flag-private-message/:messageId Flag a private message
 * @apiDescription An email and slack message are sent to the moderators about every flagged message.
 * @apiName FlagPrivateMessage
 * @apiGroup Member
 *
 * @apiParam (Path) {UUID} messageId The private message id
 *
 * @apiSuccess {Object} data The flagged private message
 * @apiSuccess {UUID} data.id The id of the message
 * @apiSuccess {String} data.text The text of the message
 * @apiSuccess {Number} data.timestamp The timestamp of the message in milliseconds
 * @apiSuccess {Object} data.likes The likes of the message (always an empty object)
 * @apiSuccess {Object} data.flags The flags of the message
 * @apiSuccess {Number} data.flagCount The number of flags the message has
 * @apiSuccess {UUID} data.uuid The User ID of the author of the message, or of the recipient if `sent` is true
 * @apiSuccess {String} data.user The Display Name of the author of the message, or of the recipient if `sent` is true
 * @apiSuccess {String} data.username The Username of the author of the message, or of the recipient if `sent` is true
 *
 * @apiUse MessageNotFound
 * @apiUse MessageIdRequired
 * @apiError (400) {BadRequest} messageGroupChatFlagAlreadyReported You have already reported this message
 */
api.flagPrivateMessage = {
  method: 'POST',
  url: '/members/flag-private-message/:messageId',
  middlewares: [authWithHeaders()],
  async handler (req, res) {
    const chatReporter = chatReporterFactory('Inbox', req, res);
    const message = await chatReporter.flag();
    res.respond(200, {
      ok: true,
      message,
    });
  },
};

api.getUsernameAutocompletes = {
  method: 'GET',
  url: '/members/find/:username',
  middlewares: [],
  async handler (req, res) {
    res.set('Cache-Control', 'public, max-age=300000'); // 5 minutes
    req.checkParams('username', res.t('invalidReqParams')).notEmpty();

    let validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    let username = req.params.username.toLowerCase();
    if (username[0] === '@') username = username.slice(1, username.length);

    if (username.length < 1) {
      res.respond(200, []);
      return;
    }

    let query = {'auth.local.lowerCaseUsername': {$regex: `^${username}.*`}, 'flags.verifiedUsername': true, 'preferences.searchableUsername': {$ne: false}};

    let context = req.query.context;
    let id = req.query.id;
    if (context && id) {
      if (context === 'party') {
        query['party._id'] = id;
      } else if (context === 'privateGuild') {
        query.guilds = id;
      }
    }

    let members = await User
      .find(query)
      .select(['profile.name', 'contributor', 'auth.local.username'])
      .limit(20)
      .exec();

    res.respond(200, members);
  },
};

module.exports = api;
