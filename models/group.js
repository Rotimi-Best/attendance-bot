const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const timestamp = require("mongoose-timestamp");

const GroupSchema = new Schema({
  name: String,
  students: [String],
  owner: {
    telegramId: Number,
    name: String
  },
  sheet: {
    id: String,
    name: String
  }
});

GroupSchema.plugin(timestamp);

const Group = mongoose.model("Group", GroupSchema);

module.exports = Group;
