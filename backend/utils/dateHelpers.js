const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr, endOfDay = false) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (endOfDay) date.setHours(23, 59, 59, 999);
    return date;
};

const getLocalDayRange = (startDate, endDate) => {
    const start = parseLocalDate(startDate, false);
    const end = parseLocalDate(endDate, true);
    return { start, end };
};

const getMsUntilNextMidnight = (date = new Date()) => {
    const nextMidnight = new Date(date);
    nextMidnight.setHours(24, 0, 0, 0);
    return nextMidnight.getTime() - date.getTime();
};

const getMsUntilTime = (hour, minute = 0, second = 0, date = new Date()) => {
    const target = new Date(date);
    target.setHours(hour, minute, second, 0);
    if (target <= date) {
        target.setDate(target.getDate() + 1);
    }
    return target.getTime() - date.getTime();
};

module.exports = {
    getLocalDateString,
    parseLocalDate,
    getLocalDayRange,
    getMsUntilNextMidnight,
    getMsUntilTime
};
