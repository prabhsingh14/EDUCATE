const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const { uploadVideoToCloudinary } = require("../utils/fileUploader");

exports.createSubSection = async (req, res) => {
    try {
      const { sectionId, title, description } = req.body;
      const video = req.files.video;
  
      if (!sectionId || !title || !description || !video) {
        return res.status(404).json({ 
          success: false, 
          message: "All Fields are Required",
        })
      }
  
      const uploadDetails = await uploadVideoToCloudinary(
        video,
        process.env.FOLDER_NAME
      )
      
      const SubSectionDetails = await SubSection.create({
        title: title,
        timeDuration: `${uploadDetails.duration}`,
        description: description,
        videoUrl: uploadDetails.secure_url,
      })
  
      const updatedSection = await Section.findByIdAndUpdate(
        { _id: sectionId },
        { $push: { subSection: SubSectionDetails._id } },
        { new: true }
      ).populate("subSection")
  
      return res.status(200).json({ 
        success: true, 
        data: updatedSection,
        message: "Sub-section created successfully",
      })
    } catch (error) {
      console.error("Error creating new sub-section:", error)
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      })
    }
}

exports.updateSubSection = async (req, res) => {
  try {
    const { sectionId, subSectionId, title, description } = req.body;
    const subSection = await SubSection.findById(sectionId);

    if (!subSection) {
      return res.status(404).json({
        success: false,
        message: "Sub-section not found",
      })
    }

    if (title !== undefined) {
      subSection.title = title
    }

    if (description !== undefined) {
      subSection.description = description
    }

    if (req.files && req.files.video !== undefined) {
      const video = req.files.video;
      const uploadDetails = await uploadVideoToCloudinary(
        video,
        process.env.FOLDER_NAME
      )
      subSection.videoUrl = uploadDetails.secure_url
      subSection.timeDuration = `${uploadDetails.duration}`
    }

    await subSection.save();

    return res.json({
      success: true,
      message: "Sub-section updated successfully",
    })
  } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while updating the sub-section",
      })
    }
}

exports.deleteSubSection = async (req, res) => {
  try {
    const { subSectionId, sectionId } = req.body
    await Section.findByIdAndUpdate(
      { _id: sectionId },
      {
        $pull: {
          subSection: subSectionId,
        },
      }
    )

    const subSection = await SubSection.findByIdAndDelete({ _id: subSectionId });

    if (!subSection) {
      return res.status(404).json({ 
        success: false, 
        message: "Sub-section not found",
      })
    }

    const updatedSection = await Section.findById(sectionId).populate("subSection");

    return res.json({
      success: true,
      message: "Sub-section deleted successfully",
      data: updatedSection,
    })
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the Sub-section",
    })
  }
}