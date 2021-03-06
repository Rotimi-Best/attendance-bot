const Telegram = require("telegram-node-bot");
const TelegramBaseController = Telegram.TelegramBaseController;
const UserController = require("./userController");
const AttendanceController = require("./attendanceController");
const attendanceController = new AttendanceController();
const {
  createNewSheet,
  addStudentsToSheet
} = require("./spreadSheetController");
const { addGroup, findGroup } = require("../Db/Groups");
const {
  DB_COLLECTIONS: { USERS, GROUPS, ATTENDANCES }
} = require("../helpers/constants");
const {
  emojis: { thumbsUp, thumbsDown, write },
  len
} = require("../modules");
const { log } = console;

class GroupController extends TelegramBaseController {
  constructor() {
    super();
    this.userObj = { userName: "", telegramId: 0, spreadsheet: {} };
  }

  /**
   * Create a new group
   * @param {Scope} $
   */
  async addGroupHandler($) {
    //Get name
    const telegramId = $.message.chat.id;
    const { userName, spreadsheet } = await this.getUser(telegramId);
    const form = this.makeNewGroupFrom($);

    $.runForm(form, async ({ groupName, students }) => {
      const trimmedStudents = Array.isArray(students)
        ? students.map(stud => stud.trim())
        : students;

      const sheetId = await createNewSheet(spreadsheet.id, groupName);

      const groupData = {
        name: groupName,
        students: trimmedStudents,
        owner: {
          telegramId,
          name: userName
        },
        sheet: {
          id: sheetId,
          name: groupName
        }
      };

      // console.log(groupData);
      await addGroup(groupData);

      setTimeout(async () => {
        const SHEET = { id: sheetId, name: groupName };
        await addStudentsToSheet(spreadsheet.id, SHEET, trimmedStudents);
      }, 2000);

      $.sendMessage(
        `Great job ${userName}, group created and I also created a new sheet in your spreadsheet called ${groupName}.\n\nUse /viewattendance to get the link`
      );
    });
  }

  /**
   * Get group
   *
   * @param {Scope} $ Scope of message
   * @param {String} name Name of the group
   */
  async getGroupHandler($, groupObj, thisMethods) {
    const telegramId = $.message.chat.id;
    const { userName } = thisMethods
      ? thisMethods.getUser(telegramId)
      : await this.getUser(telegramId);
    const groupAlreadyExist = false;

    if (groupObj) {
      const { groupName } = groupObj;
      const group = await findGroup({
        name: groupName,
        owner: { telegramId, name: userName }
      });

      if (len(group)) return group;
      else return groupAlreadyExist;
    }

    await this.getGroupMenu($, telegramId, this.groupDetailsMenu);
  }

  /**
   * Rename a group
   *
   * @param {Scope} $
   */
  async renameGroupHandler($, group, thisMethods) {
    // if ($) {
    //   $.sendMessage(())
    // }
    const { getGroupHandler } = thisMethods;
    const { _id, name, sheet } = group;
    const telegramId = $.message.chat.id;

    if (group) {
      const form = {
        newGroupName: {
          q:
            "What would be the name of your group?\n\nPlease it must begin with Group like: Group 1 or Group_1",
          error: "Sorry try again, group exists or doesn't begin with Group",
          validator: async (message, callback) => {
            const groupName = message.text;
            const testIfText = /^Group/g.test(groupName);
            log("Test", testIfText);

            const group = await getGroupHandler($, { groupName }, thisMethods);
            log("group", group);

            if (testIfText && !group) {
              callback(true, groupName);
              return;
            }
            callback(false);
          }
        }
      };

      $.runForm(form, ({ newGroupName }) => {
        console.log(newGroupName); // CONTINUE FROM HERE LATER
      });
    }
  }

  /**
   * Add students to a group
   *
   * @param {Scope} $
   */
  async addStudentsHandler($, group) {
    const telegramId = $.message.chat.id;

    $.sendMessage(`Okay `);
  }

  /**
   * Delete a group
   *
   * @param {Scope} $
   */
  deleteGroupHandler($) {
    $.sendMessage(`For now you can't delete a group`);
  }

  async getUser(telegramId) {
    if (this.userObj.telegramId === telegramId) {
      return this.userObj;
    }

    const userController = new UserController();
    const user = await userController.getUser({ telegramId });

    const [{ name, spreadsheet }] = user;

    this.userObj = { userName: name, telegramId, spreadsheet };
    return this.userObj;
  }

  makeNewGroupFrom($) {
    return {
      groupName: {
        q:
          "Alright, What would be the name of your group?\n\nPlease it must begin with Group like: Group 1 or Group_1",
        error: "Sorry try again, group exists or doesn't begin with Group",
        validator: async (message, callback) => {
          const groupName = message.text;
          const testIfText = /^Group/g.test(groupName);
          log("Test", testIfText);

          const group = await this.getGroupHandler($, { groupName });
          log("group", group);

          if (testIfText && !group) {
            callback(true, groupName);
            return;
          }
          callback(false);
        }
      },
      students: {
        q:
          "Great. Now send me the names of your students seperated with a comma, like Bill Gates, Steve Jobs",
        error: "Sorry, make sure it is seperated with a comma, be words only.",
        validator: (message, callback) => {
          const userReply = message.text;
          const testIfText = /^[A-z a-z А-Я а-я А-Я а-я]/g.test(userReply);

          const students = userReply ? userReply.split(",") : false;

          if (testIfText && students && len(students)) {
            callback(true, students);
            return;
          }

          callback(false);
        }
      }
    };
  }

  async groupDetailsMenu($, group, thisMethods) {
    const {
      renameGroupHandler,
      addStudentsHandler,
      deleteGroupHandler
    } = thisMethods;
    const { name, students } = group;
    let studentList = "";

    if (!len(students)) studentList = "None";

    for (const student of students) {
      studentList += `\n - ${student}`;
    }

    const groupDetail = `<b>Name</b>: ${name}\n<b>No of Students</b>: ${len(
      students
    )}\n<b>Students</b>: ${studentList}`;

    $.runMenu({
      message: groupDetail,
      options: {
        parse_mode: "HTML"
      },
      layout: 2,
      "Take Attendance": () => {
        attendanceController.takeAttendanceHandler($, group);
      }
      // Delete: () => {
      //   deleteGroupHandler($, group, thisMethods);
      // },
      // Rename: () => {
      //   renameGroupHandler($, group, thisMethods);
      // },
      // "Add Student": () => {
      //   addStudentsHandler($, group, thisMethods);
      // }
    });
  }

  async getGroupMenu($, telegramId, callbackOnClickGroup) {
    const { userName } = await this.getUser(telegramId);
    const thisMethods = {
      renameGroupHandler: this.renameGroupHandler,
      addStudentsHandler: this.addStudentsHandler,
      deleteGroupHandler: this.deleteGroupHandler,
      getGroupHandler: this.getGroupHandler,
      getUser: this.getUser
    };

    const groups = await findGroup({
      owner: { telegramId, name: userName }
    });

    if (len(groups)) {
      const groupsMenu = {
        message: `Choose a group ${userName}:`,
        resizeKeyboard: true,
        layout: 2
      };

      groups.forEach(group => {
        groupsMenu[group.name] = async () => {
          await callbackOnClickGroup($, group, thisMethods);
        };
      });

      $.runMenu(groupsMenu);
    } else {
      $.sendMessage(
        `Sorry ${userName}, you havn't created any group yet, use the /newgroup command to create one.`
      );
    }
  }

  get routes() {
    return {
      addGroupCommand: "addGroupHandler",
      getGroupCommand: "getGroupHandler",
      renameGroupCommand: "renameGroupHandler",
      addStudentsCommand: "addStudentsHandler",
      deleteGroupCommand: "deleteGroupHandler"
    };
  }
}

module.exports = GroupController;
