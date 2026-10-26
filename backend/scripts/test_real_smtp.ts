import nodemailer from 'nodemailer';

async function testSmtp() {
  console.log('Testing Ethereal SMTP test account creation...');
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('Ethereal Test Account created successfully:', {
      user: testAccount.user,
      smtp: { host: testAccount.smtp.host, port: testAccount.smtp.port, secure: testAccount.smtp.secure }
    });

    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const info = await transporter.sendMail({
      from: '"Apex Payroll Engine" <payroll@apexglobal.tech>',
      to: 'employee.recipient@example.com',
      subject: 'Your Confidential October 2026 Payslip - Apex Global',
      text: 'Please find attached your payslip for October 2026.',
      attachments: [
        {
          filename: 'Payslip_October_2026.pdf',
          content: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
          contentType: 'application/pdf'
        }
      ]
    });

    console.log('Message sent successfully via real SMTP socket!');
    console.log('Message ID:', info.messageId);
    console.log('Ethereal Preview URL:', nodemailer.getTestMessageUrl(info));
    return { success: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
  } catch (err) {
    console.error('SMTP test failed:', err.message);
    return { success: false, error: err.message };
  }
}

testSmtp().then(res => console.log('Result:', res));
