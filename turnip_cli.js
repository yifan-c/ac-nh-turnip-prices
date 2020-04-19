#!/usr/bin/env node

const predictions = require('./js/predictions.js');

const program = require('commander');

const fs = require('fs');

var assert = require('assert');

const now = new Date();

const millis_in_day = 24 * 60 * 60 * 1000;

const local_storage_dir = '.turnip_cli';

const csv_header = 'sun_am,sun_pm,mon_am,mon_pm,tue_am,tue_pm,wed_am,wed_pm,thu_am,thu_pm,fri_am,fri_pm,sat_am,sat_pm\n';
const csv_empty_body = 'NaN,NaN,NaN,NaN,NaN,NaN,NaN,NaN,NaN,NaN,NaN,NaN,NaN,NaN\n';
const logging_header = '│                    [sun am ] [sun pm ] [mon am ] [mon pm ] [tue am ] [tue pm ] [wed am ] [wed pm ] [thu am ] [thu pm ] [fri am ] [fri pm ] [sat am ] [sat pm ]'.toUpperCase();

const price_history_of_week_file_name = local_storage_dir + '/price_history-' + get_local_date_string(sunday_of_this_week()) + '.csv';
const local_storage_exist = fs.existsSync(price_history_of_week_file_name);

function sunday_of_this_week() {
  var epochs = now.getTime();
  var past = epochs - millis_in_day * now.getDay();
  var result = new Date();
  result.setTime(past);
  return result;
}

function get_local_date_string(date) {
  return ''.concat(date.getFullYear(), '-', date.getMonth(), '-', date.getDate());
}

if (!local_storage_exist) {
  fs.mkdirSync(local_storage_dir);
  fs.writeFileSync(price_history_of_week_file_name, csv_header + csv_empty_body, 'utf8');
}

function find_max_possiblities(possibilities, n) {
  var max = Number.NEGATIVE_INFINITY;
  const result = [];
  possibilities.forEach(function (item) {
    if (item.weekMax >= max) {
      max = item.weekMax;
      result.push(item);
      if (result.length > n) {
        result.shift();
      }
    }
  })
  return { max: max, filtered: result };
}

function find_min_possiblities(array, n) {
  var min = Number.POSITIVE_INFINITY;
  const result = [];
  array.forEach(function (item) {
    if (item.weekGuaranteedMinimum <= min) {
      min = item.weekGuaranteedMinimum;
      result.push(item);
      if (result.length > n) {
        result.shift();
      }
    }
  })
  return { min: min, filtered: result };
}

function pad_number_string(number) {
  return ('   ' + number).slice(-3);
}

function format_prices(array) {
  return array.reduce(function (acc, cur) {
    return acc + ' ' + '[' + pad_number_string(cur.min) + '~' + pad_number_string(cur.max) + ']';
  }, '');
}

program
  .version('0.0.1')

  .command('log <price>')
  .option('-p, --predict', 'predict trending after logging the price')
  .action(function (price_str, options) {
    const price = parseInt(price_str);
    assert(Number.isInteger(price), "Wrong input type! Price should be an integer.");

    const predict = options.predict || false;

    // read the price history of this week from local file storage
    const data = fs.readFileSync(price_history_of_week_file_name, 'utf8');
    lines = data.split('\n');

    assert(lines.length >= 2);

    line2 = lines[1]; // only the second line has values. 

    // parse into int array
    const values = line2.split(',').map(s => parseInt(s));

    // compute the index corresponding to the log moment
    const day_of_week = now.getDay();
    const is_pm = now.getHours() >= 12;
    const index = day_of_week * 2 + (is_pm ? 1 : 0);

    // update the price of the moment
    if (day_of_week == 0) { // in the case of sunday
      values[0] = values[1] = price;
    } else {
      values[index] = price;
    }
    const file_new_content = csv_header + values.reduce((p, c) => p + ',' + c);

    // write back to the local file storage
    fs.writeFileSync(price_history_of_week_file_name, file_new_content, 'utf8');

    if (predict) {
      console.log('----------------------------------')
      const possibilities = predictions.analyze_possibilities(values, false);

      const max_possibilities = find_max_possiblities(possibilities, 3);
      console.log('Week Maximum: ' + max_possibilities.max);
      // console.log('Top 3:');
      console.log(logging_header);
      max_possibilities.filtered.forEach(function (item, index, array) {
        const heading = (index == array.length - 1 ? '└── ' : '├── ');
        console.log(heading + 'Weekday prices: ' + format_prices(item.prices));
      })

      console.log();

      const min_possibilities = find_min_possiblities(possibilities, 3);
      console.log('Week Guaranteed Minimum: ' + min_possibilities.min);
      // console.log('Top 3:');
      console.log(logging_header);
      min_possibilities.filtered.forEach(function (item, index, array) {
        const heading = (index == array.length - 1 ? '└── ' : '├── ');
        console.log(heading + 'Weekday prices: ' + format_prices(item.prices));
      })
    }
  });

program.parse(process.argv);
