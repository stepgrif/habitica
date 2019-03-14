import { authWithHeaders } from '../../middlewares/auth';
import { chatReporterFactory } from '../../libs/chatReporting/chatReporterFactory';
import { model as User } from '../../models/user';
import { chatModel as Chat } from '../../models/message';
import uniq from 'lodash/uniq';

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
  middlewares: [authWithHeaders()],
  async handler (req, res) {
    // res.set('Cache-Control', 'public, max-age=300000'); // 5 minutes
    req.checkParams('username', res.t('invalidReqParams')).notEmpty();

    let validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    let username = req.params.username.toLowerCase();
    if (username[0] === '@') username = username.slice(1, username.length);

    if (username.length < 1) {
      res.respond(200, []);
      return;
    }

    let commonQuery = {
      'flags.verifiedUsername': true,
      'auth.blocked': {$ne: true},
      'flags.chatRevoked': {$ne: true},
      'auth.local.lowerCaseUsername': {$regex: `^${username}.*`},
    };
    let query = Object.assign({}, commonQuery);

    let context = req.query.context;
    let groupID = req.query.id;

    let members = [];
    let isPublicSpace = true;
    if (context && groupID) {
      if (context === 'party' && res.locals.user.party._id === groupID) {
        query['party._id'] = groupID;
        isPublicSpace = false;
      } else if (context === 'privateGuild' && res.locals.user.guilds.includes(groupID)) {
        query.guilds = groupID;
        isPublicSpace = false;
      } else if (context !== 'publicGuild' && context !== 'tavern') {
        res.respond(200, []);
        return;
      }

      let recentChats = await Chat
        .find({groupId: groupID, username: {$regex: `^${username}.*`}})
        .select(['uuid'])
        .sort({timestamp: -1})
        .limit(200)
        .exec();
      let recentChatters = uniq(recentChats.map((message) => {
        return message.uuid;
      }));

      let recentChatQuery = Object.assign({}, commonQuery);
      recentChatQuery._id = {$in: recentChatters};
      query._id = {$nin: recentChatters};
      members = await User
        .find(recentChatQuery)
        .select(['profile.name', 'contributor', 'auth.local.username'])
        .sort({'auth.timestamps.loggedin': -1})
        .limit(5 - members.length)
        .exec();
    }

    if (members.length < 5) {
      if (isPublicSpace) {
        query['preferences.searchableUsername'] = {$ne: false};
      }
      let secondFetch = await User
        .find(query)
        .select(['profile.name', 'contributor', 'auth.local.username'])
        .sort({'auth.timestamps.loggedin': -1})
        .limit(5 - members.length)
        .exec();
      members = members.concat(secondFetch);
    }
    res.respond(200, members);
  },
};

module.exports = api;
