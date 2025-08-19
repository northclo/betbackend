import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import GameResults from "../models/GameResult.js";

const createTestData = async () => {
  const start = moment("2025-07-10 00:00:00");
  const end = moment("2025-08-17 23:59:59");

  let docs = [];
  let round_id = 1; // start from 1

  for (let m = moment(start); m.isBefore(end); m.add(5, "minutes")) {
    let numbers = [1, 2, 3, 4, 5, 6];

    // Shuffle function (Fisher–Yates)
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    let list = numbers;

    // Logic for odd / under
    const firstNum = list[0];
    const odd = firstNum % 2 !== 0;
    const under = firstNum <= 3; // <= 3 → true, > 3 → false

    docs.push({
      list,
      round_id: round_id++,
      today_no: m.date(),
      current_no: list[5], // example (last number)
      time_stamp: m.valueOf(),
      game_id: uuidv4(),
      device_id: "device-1",
      odd,
      under,
      createdAt: m.toDate(),
      updatedAt: m.toDate()
    });
  }

  await GameResults.insertMany(docs);
  console.log(`Inserted ${docs.length} test records`);
};

const getResultsByDate = async (dateStr) => {
  // Start of day: 2025-08-15 00:00:00
  const startOfDay = moment(dateStr, "YYYY-MM-DD").startOf("day").toDate();
  
  // End of day: 2025-08-15 23:59:59.999
  const endOfDay = moment(dateStr, "YYYY-MM-DD").endOf("day").toDate();

  const results = await GameResults.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ createdAt: 1 }); // optional sorting by time

  return results;
};

const getLatestResults = async () => {

  const results = await GameResults.find()
  .sort({ createdAt: -1 })
  .limit(50); // optional sorting by time

  return results;
};


export default { createTestData, getResultsByDate, getLatestResults};