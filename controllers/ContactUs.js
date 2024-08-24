const {contactUsEmail} = require("../mail/templates/contactFormRes");
const mailSender = require("../utils/mailSender");

exports.contactUsController = async (req, res) => {
    const {email, firstName, lastName, message, phoneNo, countrycode} = req.body;

    try{
        const emailRes = await mailSender(
            email,
            "Your query has been received",
            contactUsEmail(email, firstName, lastName, message, phoneNo, countrycode)
        )

        return res.status(200).json({
            success: true,
            message: "Email sent successfully",
        });
    } catch(error){
        return res.status(500).json({
            success: false,
            message: "Could not send email",
        });
    }
};