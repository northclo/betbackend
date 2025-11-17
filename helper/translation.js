import lang from '../lang/en.js';

export const t = (key, ...args) => {
  let message = lang[key] || key;
  
  if (args.length > 0) {
    args.forEach((arg, index) => {
      message = message.replace(`{${index}}`, arg);
    });
  }
  
  return message;
};

export default t;

