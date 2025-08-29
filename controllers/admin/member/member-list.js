import bcrypt from 'bcrypt';

import UserModel from "../../../models/user.js";
import { responseSuccess } from "../../../helper/response.js";

export const getMemberList = async (req, res) => {
    let { search } = req.query;

    let filter = {};
    if (search && search.trim() !== "") {
        filter = {
            $or: [
                { firstName: { $regex: search, $options: "i" } },
                { lastName: { $regex: search, $options: "i" } },
                { userName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { company: { $regex: search, $options: "i" } },
                { phoneNumber: { $regex: search, $options: "i" } },
            ]
        };
    }

    console.log('search :>> ', search);
    let users = await UserModel.find(filter).sort({ _id: -1 });
    return responseSuccess(res, "", users);
};

export const updateMemberList = async (req, res) => {
    if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(req.body.password, salt);
    }

    await UserModel.updateOne({ _id: req.body._id }, req.body);
    return responseSuccess(res);
}

export const createMemberList = async (req, res) => {
    let { password } = req.body;

    // change password with hashed password
    const salt = await bcrypt.genSalt(10)
    req.body.password = await bcrypt.hash(password, salt)

    await UserModel.create(req.body);

    return responseSuccess(res)
}

export const deleteMemberList = async (req, res) => {
    let { id } = req.params;

    let deleteFilter = []
    id.split(',').forEach(element => {
        deleteFilter.push({
            _id: element
        })
    });

    await UserModel.deleteMany({
        $or: deleteFilter
    })
    return responseSuccess(res)
}