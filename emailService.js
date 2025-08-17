import nodemailer from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const sesClient = new SESv2Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const transporter = nodemailer.createTransport({
    SES: {sesClient, SendEmailCommand}
});

class EmailService {
    static async sendWelcomeEmail(userEmail, userName) {
        try {
            const mailOptions = {
                from: '"TJ Policy Debate" <contact@tjpolicy.com>',
                to: userEmail,
                subject: 'Welcome to Jefferson Policy!',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <h2 style="color: #333;">Welcome to TJ Policy, ${userName}!</h2>
                        <p>Thank you for joining our club, and we hope you'll stick around for the long haul.</p>
                        
                        <p>Policy debate has a long legacy at Thomas Jefferson, and we're happy that you're here.  In the past, we've been recognized on the national stage for our accomplishments and skills, and you too can join this legacy by continuing to be involved in our club.</p>
                        
                        <h3>Getting Started:</h3>
                        <ul>
                            <li>Follow us on Instagram at <a href="https://www.instagram.com/tj.policy/">@tj.policy</a></li>
                            <li>If you haven't joined our Messenger group, do that now</li>
                            <li>If you haven't gotten access to our Dropbox, talk to an officer and you'll receive access</li>
                        </ul>
                        
                        <p>If you have any questions, please talk to an officer.</p>
                        
                        <p>${captainOne} and ${captainTwo}</p>
                        <p>Jefferson Policy Captains</p>
                    </div>
                `,
                text: `
                    Welcome to TJ Policy, ${userName}!
                
                    Thank you for joining our club, and we hope you'll stick around for the long haul.
                    
                    Policy debate has a long legacy at TJ, and we're happy that you're here.  In the past, we've been recognized on the national stage for our accomplishments and skills, and you too can join this legacy by continuing to be involved in Jefferson Policy.
                    
                    Getting Started:
                
                     - Follow us on Instagram at https://www.instagram.com/tj.policy/
                     - If you haven't joined our Messenger group, do that now
                     - If you haven't gotten access to our Dropbox, talk to an officer and you'll receive access
                    
                    If you have any questions, please talk to an officer.
                    
                    ${captainOne} and ${captainTwo}
                    Jefferson Policy Captains

                `
            };

            const result = await transporter.sendMail(mailOptions);
            return result;
        } catch (error) {
            console.error('Error sending welcome email:', error);
            throw error;
        }
    }

}

export default EmailService;