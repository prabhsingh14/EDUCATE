const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const { uploadVideoToCloudinary } = require("../utils/fileUploader");

// Controller function to create a new sub-section and add it to a section
exports.createSubSection = async (req, res) => {
    try {
        const { sectionId, title, description } = req.body;
        const video = req.files.video;

        // Validate that all required fields are provided
        if (!sectionId || !title || !description || !video) {
            return res.status(404).json({
                success: false,
                message: "All Fields are Required",
            });
        }

        // Upload video to Cloudinary and get the upload details
        const uploadDetails = await uploadVideoToCloudinary(
            video,
            process.env.FOLDER_NAME
        );

        // Create a new sub-section with the provided details
        const SubSectionDetails = await SubSection.create({
            title: title,
            timeDuration: `${uploadDetails.duration}`, // Duration of the video
            description: description,
            videoUrl: uploadDetails.secure_url, // URL of the uploaded video
        });

        // Update the section to include the newly created sub-section
        const updatedSection = await Section.findByIdAndUpdate(
            { _id: sectionId },
            { $push: { subSection: SubSectionDetails._id } },
            { new: true }
        ).populate("subSection");

        return res.status(200).json({
            success: true,
            data: updatedSection,
            message: "Sub-section created successfully",
        });
    } catch (error) {
        console.error("Error creating new sub-section:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// Controller function to update an existing sub-section
exports.updateSubSection = async (req, res) => {
    try {
        const { sectionId, subSectionId, title, description } = req.body;
        const subSection = await SubSection.findById(subSectionId); // Find the sub-section by ID

        if (!subSection) {
            return res.status(404).json({
                success: false,
                message: "Sub-section not found",
            });
        }

        // Update fields if provided
        if (title !== undefined) {
            subSection.title = title;
        }

        if (description !== undefined) {
            subSection.description = description;
        }

        // Upload new video if provided and update details
        if (req.files && req.files.video !== undefined) {
            const video = req.files.video;
            const uploadDetails = await uploadVideoToCloudinary(
                video,
                process.env.FOLDER_NAME
            );
            subSection.videoUrl = uploadDetails.secure_url;
            subSection.timeDuration = `${uploadDetails.duration}`;
        }

        // Save the updated sub-section
        await subSection.save();

        return res.json({
            success: true,
            message: "Sub-section updated successfully",
        });
    } catch (error) {
        console.error("Error updating sub-section:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while updating the sub-section",
        });
    }
};

// Controller function to delete a sub-section and remove it from the section
exports.deleteSubSection = async (req, res) => {
    try {
        const { subSectionId, sectionId } = req.body;

        // Remove the sub-section from the section's sub-section list
        await Section.findByIdAndUpdate(
            { _id: sectionId },
            {
                $pull: {
                    subSection: subSectionId,
                },
            }
        );

        // Delete the sub-section
        const subSection = await SubSection.findByIdAndDelete({ _id: subSectionId });

        if (!subSection) {
            return res.status(404).json({
                success: false,
                message: "Sub-section not found",
            });
        }

        // Retrieve and populate the updated section to reflect changes
        const updatedSection = await Section.findById(sectionId).populate("subSection");

        return res.json({
            success: true,
            message: "Sub-section deleted successfully",
            data: updatedSection,
        });
    } catch (error) {
        console.error("Error deleting sub-section:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while deleting the Sub-section",
        });
    }
};
