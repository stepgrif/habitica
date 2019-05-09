<template lang="pug">
  .row.chat-row
    .col-12
      h3.float-left.label(:class="{accepted: communityGuidelinesAccepted }") {{ label }}
      div.float-right(v-markdown='$t("markdownFormattingHelp")')

      .row(v-if="communityGuidelinesAccepted")
        textarea(:placeholder='placeholder',
                  v-model='newMessage',
                  ref='user-entry',
                  :class='{"user-entry": newMessage}',
                  @keyup.ctrl.enter='sendMessageShortcut()',
                  @paste='disableMessageSendShortcut()',
                  maxlength='3000',
                  :contenteditable='true'
                )
      span.chat-count {{ currentLength }} / 3000

      community-guidelines

      .row.chat-actions
        .col-6.chat-receive-actions
          button.btn.btn-secondary.float-left.fetch(v-once, @click='fetchRecentMessages()') {{ $t('fetchRecentMessages') }}
          button.btn.btn-secondary.float-left(v-once, @click='reverseChat()') {{ $t('reverseChat') }}
        .col-6.chat-send-actions
          button.btn.btn-primary.send-chat.float-right(v-once, @click='sendMessage()') {{ $t('send') }}

      community-guidelines

      slot(
        name="additionRow",
      )

      .row
        .hr.col-12
        chat-message(:chat.sync='group.chat', :group-type='group.type', :group-id='group._id', :group-name='group.name')
</template>

<script>
  import VueTribute from 'vue-tribute';
  import axios from 'axios';
  import debounce from 'lodash/debounce';

  import markdownDirective from 'client/directives/markdown';
  import communityGuidelines from './communityGuidelines';
  import chatMessage from '../chat/chatMessages';
  import { mapState } from 'client/libs/store';
  import markdownDirective from 'client/directives/markdown';

  export default {
    props: ['label', 'group', 'placeholder'],
    directives: {
      markdown: markdownDirective,
    },
    components: {
      communityGuidelines,
      chatMessage,
      VueTribute,
    },
    directives: {
      markdown: markdownDirective,
    },
    data () {
      return {
        newMessage: '',
        sending: false,
        chat: {
          submitDisable: false,
          submitTimeout: null,
        },
        coords: {
          TOP: 0,
          LEFT: 0,
        },
        textbox: this.$refs,
        icons: Object.freeze({
          tier1,
          tier2,
          tier3,
          tier4,
          tier5,
          tier6,
          tier7,
          tier8,
          tier9,
          tierNPC,
        }),
        autocompleteOptions: {
          values: debounce(async (text, cb) => {
            if (text.length > 0) {
              let suggestions = await axios.get(`/api/v4/members/find/${text}?context=${this.autocompleteContext}&id=${this.group._id}`);
              cb(suggestions.data.data);
            } else {
              cb([]);
            }
          }, 200),
          selectTemplate (item) {
            return `<span class="at-highlight">@${item.original.auth.local.username}</span>`;
          },
          lookup (item) {
            return item.auth.local.username;
          },
          menuItemTemplate (item) {
            let userTierClass = styleHelper.methods.userLevelStyle(item.original);
            return `<h3 class='profile-name ${userTierClass}'> ${item.original.profile.name}</h3> @${item.string}`;
          },
        },
      };
    },
    computed: {
      ...mapState({user: 'user.data'}),
      currentLength () {
        return this.newMessage.length;
      },
      communityGuidelinesAccepted () {
        return this.user.flags.communityGuidelinesAccepted;
      },
    },
    methods: {
      async sendMessageShortcut () {
        // If the user recently pasted in the text field, don't submit
        if (!this.chat.submitDisable) {
          this.sendMessage();
        }
      },
      async sendMessage () {
        if (this.sending) return;
        this.sending = true;
        let response;

        try {
          response = await this.$store.dispatch('chat:postChat', {
            group: this.group,
            message: this.newMessage,
          });
        } catch (e) {
          // catch exception to allow function to continue
        }

        if (response) {
          this.group.chat.unshift(response.message);
          this.newMessage = '';
        }

        this.sending = false;
        this.$refs['user-entry'].innerText = '';


        // @TODO: I would like to not reload everytime we send. Why are we reloading?
        // The response has all the necessary data...
        let chat = await this.$store.dispatch('chat:getChat', {groupId: this.group._id});
        this.group.chat = chat;
      },

      disableMessageSendShortcut () {
        // Some users were experiencing accidental sending of messages after pasting
        // So, after pasting, disable the shortcut for a second.
        this.chat.submitDisable = true;

        if (this.chat.submitTimeout) {
          // If someone pastes during the disabled period, prevent early re-enable
          clearTimeout(this.chat.submitTimeout);
          this.chat.submitTimeout = null;
        }

        this.chat.submitTimeout = window.setTimeout(() => {
          this.chat.submitTimeout = null;
          this.chat.submitDisable = false;
        }, 500);
      },

      selectedAutocomplete (newText) {
        this.newMessage = newText;
      },

      fetchRecentMessages () {
        this.$emit('fetchRecentMessages');
      },
      reverseChat () {
        this.group.chat.reverse();
      },
      tierIcon (user) {
        const isNPC = Boolean(user.backer && user.backer.npc);
        if (isNPC) {
          return this.icons.tierNPC;
        }
        return this.icons[`tier${user.contributor.level}`];
      },
      autocompleteReplaced () {
        this.updateChatInput();
      },
      updateChatInput () {
        let innerText = this.$refs['user-entry'].innerText;
        if (innerText[innerText.length - 1] === '\n') {
          innerText = innerText.slice(0, -1);
        }
        this.newMessage = innerText;
      },
    },
    beforeRouteUpdate (to, from, next) {
      // Reset chat
      this.newMessage = '';
      this.coords = {
        TOP: 0,
        LEFT: 0,
      };

      next();
    },
  };
</script>

<style lang="scss">
  @import '~client/assets/scss/tribute.scss';
</style>

<style scoped lang="scss">
  @import '~client/assets/scss/colors.scss';

  @import '~client/assets/scss/variables.scss';

  .chat-actions {
    margin-top: 1em;
    margin-left: 0;
    margin-right: 0;

    .chat-receive-actions {
      padding-left: 0;

      button {
        margin-bottom: 1em;

        &:not(:last-child) {
          margin-right: 1em;
        }
      }
    }

    .chat-send-actions {
      padding-right: 0;
    }
  }

  .chat-row {
    position: relative;

    .label:not(.accepted) {
      color: #a5a1ac;
    }

    .row {
      margin-left: 0;
      margin-right: 0;
      clear: both;
    }

    textarea {
      min-height: 150px;
      width: 100%;
      background-color: $white;
      box-shadow: 0 0 3pt 2pt white;
      border-radius: 2px;
      line-height: 1.43;
      color: $gray-300;
      padding: 10px 12px;
    }

    .user-entry:empty:before {
      content: attr(placeholder);
      display: block; /* For Firefox */
      color: $gray-300;
    }

    .user-entry:focus {
      outline: solid 0px transparent;
      box-shadow: 0 0 0 1pt $purple-500;
    }

    .hr {
      width: 100%;
      height: 20px;
      border-bottom: 1px solid $gray-500;
      text-align: center;
      margin: 2em 0;
    }

    .hr-middle {
      font-size: 16px;
      font-weight: bold;
      font-family: 'Roboto Condensed';
      line-height: 1.5;
      text-align: center;
      color: $gray-200;
      background-color: $gray-700;
      padding: .2em;
      margin-top: .2em;
      display: inline-block;
      width: 100px;
    }

    .chat-count {
      margin-top: 8px;
      display: block;
    }
  }

  .v-tribute {
    width: 100%;
  }
</style>
