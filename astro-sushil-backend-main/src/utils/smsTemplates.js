const fillTemplate = (template, values) =>
  values.reduce((msg, value) => msg.replace("{#var#}", value), template);

export const smsTemplates = {
  BOOKING_CONFIRMED: ({ userName, consultationTitle, date, mode, slot, amount }) =>
    fillTemplate(
      `Hello {#var#}, Your consultation has been booked. We look forward to connecting with you. Service Name: {#var#} Date: {#var#} Service Mode: {#var#} Time: {#var#} Amount: {#var#} Thank you for choosing ASTRO SUSHIL PRIVATE LIMITED`,
      [userName, consultationTitle, date, mode, slot, amount],
    ),

  BOOKING_RESCHEDULED: ({ userName, consultationTitle, date, mode, slot, amount }) =>
    fillTemplate(
      `Hello  {#var#}, Your Consultation has been rescheduled. We look forward to connecting with you. Service Name:  {#var#} Date:  {#var#} Service Mode:  {#var#} Time:  {#var#} Amount: ₹ {#var#} Thank you for choosing ASTRO SUSHIL PRIVATE LIMITED`,
      [userName, consultationTitle, date, mode, slot, amount],
    ),

  ORDER_UPDATE: ({ userName, orderId, productName, orderStatus }) =>
    fillTemplate(
      `Hello {#var#}, Your order update is here Order ID-{#var#} Product Name-{#var#}Order Status-{#var#} Thank for ordering. ASTRO SUSHIL PRIVATE LIMITED`,
      [userName, orderId, productName, orderStatus],
    ),

  REPORT_PURCHASE: ({ userName }) =>
    fillTemplate(
      `Hello {#var#}Thank you for purchasing your Kundali Report with us 🙏 We have successfully received your request. Your detailed Kundali report is currently being prepared and will be delivered to you within the next 48 hours. If you have any questions in the meantime, feel free to reach out to us. We appreciate your trust!  ✨. ASTRO SUSHIL PRIVATE LIMITED`,
      [userName],
    ),
};
