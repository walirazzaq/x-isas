import isas, { Isas } from './index.js';
import { calendarAdapter, datePickerAdapter } from './adapters/daisyui/calendar.js';
import { Calendar } from './components/calendar/calendar.js';
import { DatePicker } from './components/calendar/date-picker.js';
import { DatePreset } from './components/calendar/date-preset.js';

Isas.components.register('calendar', Calendar);
Isas.components.register('date-picker', DatePicker);
Isas.components.register('date-preset', DatePreset);
Isas.adapters.register('calendar', calendarAdapter);
Isas.adapters.register('date-picker', datePickerAdapter);

export default isas;
export * from './index.js';
export { Calendar } from './components/calendar/calendar.js';
export { DatePicker } from './components/calendar/date-picker.js';
export { DatePreset } from './components/calendar/date-preset.js';
export { CalendarDriver } from './components/calendar/calendar-driver.js';
export { calendarAdapter, datePickerAdapter } from './adapters/daisyui/calendar.js';
