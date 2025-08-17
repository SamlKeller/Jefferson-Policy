import axios from 'axios';

const ION_BASE_URL = 'https://ion.tjhsst.edu';

export async function getIonProfile(accessToken) {
    try {
        const response = await axios.get(`${ION_BASE_URL}/api/profile`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching Ion profile:', error);
        throw error;
    }
}

export async function getIonSchedule(accessToken) {
    try {
        const response = await axios.get(`${ION_BASE_URL}/api/schedule`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching Ion schedule:', error);
        throw error;
    }
}

export async function getIonEighthPeriod(accessToken) {
    try {
        const response = await axios.get(`${ION_BASE_URL}/api/eighth/signup`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching eighth period data:', error);
        throw error;
    }
}

// Route to refresh user data from Ion
app.get('/refresh-ion-data', Utils.ensureLogin, async (req, res) => {
    if (!req.session.ionTokens?.accessToken) {
        return res.status(400).json({ error: 'No Ion access token available' });
    }
    
    try {
        const ionProfile = await getIonProfile(req.session.ionTokens.accessToken);
        
        // Update user with latest Ion data
        await User.findByIdAndUpdate(req.user._id, {
            graduationYear: ionProfile.graduation_year,
            'settings.grade': ionProfile.grade?.number || ionProfile.grade
        });
        
        res.json({ success: true, data: ionProfile });
    } catch (error) {
        console.error('Error refreshing Ion data:', error);
        res.status(500).json({ error: 'Failed to refresh Ion data' });
    }
});