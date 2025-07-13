document.addEventListener('DOMContentLoaded', () => {
    // 3D scene variables
    let scene, camera, renderer, bottleMesh, controls; 

    const allPages = document.querySelectorAll('.page');
    let currentUser = null;

    // --- Helper function for date formatting ---
    function formatDate(dateString) {
        if (!dateString) {
            return '';
        }
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString; 
            }
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC'
            });
        } catch (error) {
            console.error("Could not format date:", dateString, error);
            return dateString;
        }
    }

    // --- Main App Initialization & Router ---
    async function initApp() {
        const loggedInEmployeeId = sessionStorage.getItem('loggedInEmployeeId');
        if (loggedInEmployeeId) {
            try {
                const response = await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getUser',
                        employee_id: loggedInEmployeeId
                    })
                });
                const data = await response.json();
                if (data.success) {
                    currentUser = data.user;
                    if(window.location.hash !== '#bottle') {
                        window.location.hash = '#bottle';
                        return;
                    }
                } else {
                    sessionStorage.removeItem('loggedInEmployeeId');
                }
            } catch (error) {
                console.error("Failed to auto-login:", error);
                sessionStorage.removeItem('loggedInEmployeeId');
            }
        }
        
        navigate();
        window.addEventListener('hashchange', navigate);
    }

    async function navigate() {
        const hash = window.location.hash || '#login';
        const pageName = hash.split('?')[0].substring(1); 
        
        allPages.forEach(page => page.classList.add('hidden'));
        let activePage = document.getElementById(pageName + '-page');

        if (pageName === 'bottle' && !currentUser) {
            window.location.hash = '#login';
            return;
        } else if (!activePage) {
            activePage = document.getElementById('login-page');
        }
        
        activePage.classList.remove('hidden');

        if (pageName === 'bottle' && currentUser) {
            await initBottlePage(currentUser);
        } else if (pageName === 'add-sticker') {
            initAddStickerPage(); 
        } else if (pageName === 'admin-dashboard') {
            if (sessionStorage.getItem('isAdmin') === 'true') {
                initAdminDashboard();
            } else {
                 window.location.hash = 'login';
            }
        } else if (pageName === 'login') {
            currentUser = null;
            sessionStorage.removeItem('loggedInEmployeeId');
            sessionStorage.removeItem('isAdmin');
        }
    }
    
    // ===============================================
    //  LOGIN LOGIC
    // ===============================================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const employeeId = document.getElementById('login-employee-id').value.trim();
            const loginError = document.getElementById('login-error');
            loginError.textContent = '';
            if (!employeeId) return;

            try {
                const response = await fetch('/api', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'getUser',
                        employee_id: employeeId
                    })
                });
                const data = await response.json();
                if (data.success) {
                    currentUser = data.user;
                    sessionStorage.setItem('loggedInEmployeeId', currentUser.employee_id);
                    if (currentUser.employee_id === 'cg12420') {
                        sessionStorage.setItem('isAdmin', 'true');
                    }
                    window.location.hash = 'bottle';
                } else {
                    loginError.textContent = data.message || 'User not found.';
                }
            } catch (error) {
                loginError.textContent = 'Failed to connect to the server.';
            }
        });
    }

    // ===============================================
    //  BOTTLE PAGE LOGIC
    // ===============================================
    
    function createWaterBottle() {
        const bottleGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00BFFF, roughness: 0.2, metalness: 0.1 });
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
        
        const bodyGeo = new THREE.CylinderGeometry(0.8, 0.7, 3, 32);
        bottleMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bottleMesh.name = 'bottleBody';
        bottleGroup.add(bottleMesh);

        const points = [ new THREE.Vector2(0.4, 0), new THREE.Vector2(0.7, 0), new THREE.Vector2(0.7, 0.5), new THREE.Vector2(0.4, 0.8), new THREE.Vector2(0.4, 1.1) ];
        const lidGeo = new THREE.LatheGeometry(points, 32);
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.y = 1.5; 
        bottleGroup.add(lid);

        return bottleGroup;
    }

    function init3DScene(user) {
        const container = document.getElementById('bottle-viewer-container');
        const canvas = document.getElementById('bottle-canvas');
        if (!container || !canvas) return;

        if (renderer) {
            renderer.dispose();
            const oldCanvas = container.querySelector('canvas');
            if(oldCanvas && oldCanvas !== canvas) oldCanvas.remove();
        }

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xd8dde1);
        camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 0, 7);

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minDistance = 3;
        controls.maxDistance = 10;
        controls.enablePan = false;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);

        const bottle = createWaterBottle();
        scene.add(bottle);

        if (window.TWEEN) {
            new TWEEN.Tween(bottle.rotation)
                .to({ y: bottle.rotation.y + Math.PI * 2 }, 1500)
                .easing(TWEEN.Easing.Quintic.Out)
                .start();
        }

        if (user && user.stickers && user.stickers.length > 0) {
            if (typeof THREE.DecalGeometry === 'undefined') {
                console.error("DecalGeometry not loaded. Make sure to include it in index.html.");
                return;
            }
            
            const textureLoader = new THREE.TextureLoader();
            const decalSize = new THREE.Vector3(1.2, 1.2, 1.2);

            const decalPositions = [
                { pos: new THREE.Vector3(0, 1.0, 0.85) }, { pos: new THREE.Vector3(0.85, 0.2, 0) },
                { pos: new THREE.Vector3(0, -0.5, -0.85) }, { pos: new THREE.Vector3(-0.85, -0.9, 0) },
                { pos: new THREE.Vector3(0.65, 0.6, 0.65) }, { pos: new THREE.Vector3(-0.65, -0.2, -0.65) },
                { pos: new THREE.Vector3(0.75, -0.8, 0.45) }, { pos: new THREE.Vector3(-0.75, 0.8, -0.45) },
            ];

            user.stickers.slice(0, decalPositions.length).forEach((sticker, index) => {
                textureLoader.load(sticker.image_data, (texture) => {
                    const decalMaterial = new THREE.MeshStandardMaterial({
                        map: texture, transparent: true, depthTest: true,
                        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5,
                        alphaTest: 0.5, roughness: 0.4, metalness: 0.1
                    });
                    
                    const decalInfo = decalPositions[index];
                    const rotationMatrix = new THREE.Matrix4();
                    rotationMatrix.lookAt(decalInfo.pos, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
                    const decalRotation = new THREE.Euler().setFromRotationMatrix(rotationMatrix);
                    
                    const decal = new THREE.Mesh(
                        new THREE.DecalGeometry(bottleMesh, decalInfo.pos, decalRotation, decalSize),
                        decalMaterial
                    );
                    bottleMesh.add(decal);
                });
            });
        }

        function animate() {
            requestAnimationFrame(animate);
            if (window.TWEEN) {
                TWEEN.update();
            }
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
        
        window.onresize = () => {
             if (!container) return;
             camera.aspect = container.clientWidth / container.clientHeight;
             camera.updateProjectionMatrix();
             renderer.setSize(container.clientWidth, container.clientHeight);
        };
    }
    
    async function initBottlePage(user) {
        const bottlePage = document.getElementById('bottle-page');
        
        const existingGear = bottlePage.querySelector('.admin-gear-link');
        if(existingGear) existingGear.remove();

        if (user.employee_id === 'cg12420') {
            const viewerContainer = bottlePage.querySelector('#bottle-viewer-container');
            if (viewerContainer) {
                const gearLink = document.createElement('a');
                gearLink.href = '#admin-dashboard';
                gearLink.className = 'admin-gear-link';
                gearLink.title = 'Go to Admin Dashboard';
                gearLink.innerHTML = `<span class="material-icons">settings</span>`;
                viewerContainer.appendChild(gearLink);
            }
        }
        
        init3DScene(user); 
        loadUserStickers(user);
    }

    function loadUserStickers(user) {
        const grid = document.getElementById('sticker-list-grid');
        if(!grid) return;
        grid.innerHTML = '';

        if (user.stickers && user.stickers.length > 0) {
            user.stickers.forEach(sticker => {
                const stickerEl = document.createElement('div');
                stickerEl.className = 'sticker-item-card';
                stickerEl.dataset.stickerId = sticker.id;
                stickerEl.dataset.eventName = sticker.event_name;
                stickerEl.dataset.eventDate = sticker.event_date;
                stickerEl.dataset.description = sticker.description;
                stickerEl.dataset.imageData = sticker.image_data;

                stickerEl.innerHTML = `
                    <img src="${sticker.image_data}" alt="${sticker.event_name}" class="sticker-item-img">
                    <div class="sticker-item-info">
                        <h4>${sticker.event_name}</h4>
                        <p>${formatDate(sticker.event_date)}</p>
                    </div>
                `;
                grid.appendChild(stickerEl);
            });
        } else {
            grid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Your sticker collection is empty.</p>';
        }
    }

    const stickerListGrid = document.getElementById('sticker-list-grid');
    if (stickerListGrid) {
        stickerListGrid.addEventListener('click', async (e) => {
            const card = e.target.closest('.sticker-item-card');
            if (!card) return;

            const modal = document.getElementById('user-feedback-modal');
            const stickerId = card.dataset.stickerId;
            
            document.getElementById('modal-sticker-img').src = card.dataset.imageData;
            document.getElementById('modal-sticker-title').textContent = card.dataset.eventName;
            document.getElementById('modal-sticker-date').textContent = formatDate(card.dataset.eventDate);
            document.getElementById('modal-sticker-description').textContent = card.dataset.description;
            
            document.getElementById('user-feedback-form').dataset.stickerId = stickerId;
            
            const commentTextarea = document.getElementById('user-feedback-comment');
            commentTextarea.value = 'Loading feedback...';
            
            const response = await fetch(`/api?action=getStickerInfo&sticker_id=${stickerId}&employee_id=${currentUser.employee_id}`);
            const data = await response.json();
            if (data.success) {
                commentTextarea.value = data.user_feedback || '';
            } else {
                commentTextarea.value = 'Could not load feedback.';
            }

            modal.classList.remove('hidden');
        });
    }

    const feedbackModal = document.getElementById('user-feedback-modal');
    if (feedbackModal) {
        feedbackModal.addEventListener('click', async (e) => {
            if (e.target === feedbackModal) {
                const form = document.getElementById('user-feedback-form');
                const stickerId = form.dataset.stickerId;
                const comment = document.getElementById('user-feedback-comment').value;

                await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'submitFeedback',
                        sticker_id: stickerId,
                        employee_id: currentUser.employee_id,
                        comment: comment
                    })
                });
                
                feedbackModal.classList.add('hidden');
            }
        });
    }


    // ===============================================
    //  ADD STICKER PAGE LOGIC
    // ===============================================
    async function initAddStickerPage() {
        const container = document.getElementById('claim-container');
        const stickerImage = document.getElementById('sticker-image');
        const claimButton = document.getElementById('claim-button');
        const idModal = document.getElementById('id-modal');
        const confirmModal = document.getElementById('confirm-modal');
        const registerModal = document.getElementById('register-modal');
        const errorDivs = document.querySelectorAll('#add-sticker-page .error-message');
        errorDivs.forEach(div => div.textContent = '');
        
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const stickerId = urlParams.get('id');
        if (!stickerId) { container.innerHTML = '<h1>Error: No sticker ID provided.</h1>'; return; }

        function showClaimModal(modalToShow) { 
            idModal.classList.add('hidden'); 
            confirmModal.classList.add('hidden'); 
            registerModal.classList.add('hidden'); 
            if (modalToShow) { modalToShow.classList.remove('hidden'); } 
        }

        try { 
            const response = await fetch(`/api?action=getStickerInfo&sticker_id=${stickerId}`); 
            const data = await response.json(); 
            if (data.success) { 
                stickerImage.src = data.sticker.image_data; 
                stickerImage.alt = data.sticker.event_name; 
            } else { 
                container.innerHTML = `<h1>Error: ${data.message}</h1>`; 
            } 
        } catch (error) { 
            container.innerHTML = `<h1>Error: Could not connect to the server.</h1>`; 
        }

        claimButton.onclick = () => showClaimModal(idModal);
        
        document.querySelectorAll('#add-sticker-page .modal-back-button').forEach(button => { 
            button.onclick = () => { 
                const parentModal = button.closest('.modal'); 
                if (parentModal && parentModal.id === 'register-modal') { showClaimModal(idModal); } 
                else if (parentModal && parentModal.id === 'confirm-modal') { showClaimModal(idModal); } 
                else { showClaimModal(null); } 
            }; 
        });

        const idForm = document.getElementById('id-form');
        idForm.onsubmit = async (event) => { 
            event.preventDefault(); 
            const idInput = document.getElementById('employee-id-input'); 
            const employeeId = idInput.value.trim(); 
            const idError = document.getElementById('id-error'); 
            idError.textContent = ''; 
            if (!employeeId) return; 

            const response = await fetch('/api', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getUser', employee_id: employeeId })
            }); 
            const data = await response.json(); 
            if (data.success) { 
                const confirmTitle = document.getElementById('confirm-title'); 
                confirmTitle.textContent = `Add sticker to ${data.user.full_name}'s bottle?`; 
                showClaimModal(confirmModal); 
            } else { 
                showClaimModal(registerModal); 
            } 
        };

        const registerForm = document.getElementById('register-form');
        registerForm.onsubmit = async (event) => { 
            event.preventDefault(); 
            const employeeId = document.getElementById('employee-id-input').value.trim(); 
            const fullNameInput = document.getElementById('full-name-input'); 
            const fullName = fullNameInput.value.trim(); 
            const registerError = document.getElementById('register-error'); 
            registerError.textContent = ''; 

            const response = await fetch('/api', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'registerAndAddSticker', 
                    employee_id: employeeId, 
                    full_name: fullName, 
                    sticker_id: stickerId 
                })
            }); 
            const data = await response.json(); 
            if(data.success) { 
                await showSuccessAndRedirect(registerModal, employeeId); 
            } else { 
                registerError.textContent = data.message || 'Registration failed.'; 
            } 
        };

        const confirmYesButton = document.getElementById('confirm-yes-button');
        confirmYesButton.onclick = async () => { 
            const employeeId = document.getElementById('employee-id-input').value.trim(); 
            
            const response = await fetch('/api', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'addSticker', 
                    employee_id: employeeId, 
                    sticker_id: stickerId 
                })
            }); 
            const data = await response.json(); 
            if (data.success) { 
                await showSuccessAndRedirect(confirmModal, employeeId); 
            } else { 
                alert('An error occurred.'); 
            } 
        };
        
        // UPDATED: This function now correctly populates the user session before redirecting.
        async function showSuccessAndRedirect(currentModal, employeeId) {
            sessionStorage.setItem('loggedInEmployeeId', employeeId);

            // Fetch the user data to populate the currentUser variable before navigating
            try {
                const response = await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getUser',
                        employee_id: employeeId
                    })
                });
                const data = await response.json();
                if (data.success) {
                    currentUser = data.user; // This is the crucial step
                    window.location.hash = '#bottle';
                } else {
                    // Fallback if user fetch fails for some reason
                    window.location.hash = '#login';
                }
            } catch (error) {
                console.error("Error fetching user after adding sticker:", error);
                window.location.hash = '#login';
            }
            // The hashchange event listener will automatically call navigate()
        }
    }
    
    // ===============================================
    //  ADMIN DASHBOARD LOGIC
    // ===============================================
    async function initAdminDashboard() {
        const createStickerForm = document.getElementById('create-sticker-form');
        if (createStickerForm && !createStickerForm._isInitialized) { 
            createStickerForm._isInitialized = true; 
            createStickerForm.addEventListener('submit', handleCreateStickerSubmit); 
        }
        const stickerCardList = document.getElementById('sticker-card-list');
        if (stickerCardList && !stickerCardList._isInitialized) { 
            stickerCardList._isInitialized = true; 
            stickerCardList.addEventListener('click', handleCardActions); 
        }
        const shareModal = document.getElementById('share-modal');
        if (shareModal && !shareModal._isInitialized) { 
            shareModal._isInitialized = true; 
            const copyBtn = document.getElementById('copy-link-btn'); 
            const closeBtn = document.getElementById('close-share-modal-btn'); 
            const urlInput = document.getElementById('share-url-input'); 
            copyBtn.addEventListener('click', () => { 
                urlInput.select(); 
                document.execCommand('copy'); 
                const icon = copyBtn.querySelector('.material-icons'); 
                icon.textContent = 'done'; 
                setTimeout(() => { icon.textContent = 'content_copy'; }, 2000); 
            }); 
            closeBtn.addEventListener('click', () => { shareModal.classList.add('hidden'); }); 
        }
        const feedbackModal = document.getElementById('feedback-modal');
        if (feedbackModal && !feedbackModal._isInitialized) { 
            feedbackModal._isInitialized = true; 
            const closeBtn = document.getElementById('close-feedback-modal-btn'); 
            closeBtn.addEventListener('click', () => { feedbackModal.classList.add('hidden'); }); 
        }
        
        await loadAdminStickers();
    }

    async function handleCreateStickerSubmit(e) {
        e.preventDefault();
        const eventName = document.getElementById('event-name').value;
        const eventDate = document.getElementById('event-date').value;
        const description = document.getElementById('description').value;
        const fileInput = document.getElementById('sticker-image-upload');
        const file = fileInput.files[0];
        
        if (!eventName || !eventDate || !file) {
            alert('Please fill out Event Name, Event Date, and select an image.');
            return;
        }
        
        const createStickerBtn = document.getElementById('create-sticker-btn');
        createStickerBtn.disabled = true;
        createStickerBtn.textContent = 'Creating...';

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const imageData = reader.result;
            if (imageData.length > 2 * 1024 * 1024) { // 2MB limit
                alert('Image is too large (max 2MB).');
                createStickerBtn.disabled = false;
                createStickerBtn.textContent = 'Create Sticker';
                return;
            }

            try {
                const response = await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'createSticker',
                        event_name: eventName,
                        event_date: eventDate,
                        description: description,
                        sticker_image_data: imageData
                    })
                });
                const data = await response.json();
                if (data.success) {
                    alert('Sticker created successfully!');
                    e.target.reset();
                    await loadAdminStickers();
                } else {
                    alert('Error creating sticker: ' + (data.message || 'Unknown error'));
                }
            } catch (error) {
                alert("A server error occurred while creating the sticker.");
            } finally {
                createStickerBtn.disabled = false;
                createStickerBtn.textContent = 'Create Sticker';
            }
        };
        reader.onerror = () => {
             alert('Error reading the selected file.');
             createStickerBtn.disabled = false;
             createStickerBtn.textContent = 'Create Sticker';
        };
    }

    async function handleCardActions(e) {
        const button = e.target.closest('button.icon-btn');
        if (!button) return;

        const card = button.closest('.sticker-card');
        const id = card.dataset.stickerId;
        
        if (button.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to permanently delete this sticker?')) {
                await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'deleteSticker', sticker_id: id })
                });
                await loadAdminStickers();
            }
        } else if (button.classList.contains('edit-btn')) {
            card.classList.add('editing');
            const title = card.querySelector('.sticker-card-title');
            const date = card.querySelector('.sticker-card-date');
            const description = card.querySelector('.sticker-card-body p');
            
            title.innerHTML = `<input type="text" class="form-group" value="${title.dataset.originalValue}">`;
            date.innerHTML = `<input type="date" class="form-group" value="${date.dataset.originalValue}">`;
            description.innerHTML = `<textarea rows="3" class="form-group">${description.dataset.originalValue}</textarea>`;

            button.innerHTML = '<span class="material-icons">save</span>';
            button.title = 'Save Changes';
            button.classList.remove('edit-btn');
            button.classList.add('save-btn');
        } else if (button.classList.contains('save-btn')) {
            await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateStickerDetails',
                    sticker_id: id,
                    event_name: card.querySelector('.sticker-card-title input').value,
                    event_date: card.querySelector('.sticker-card-date input').value,
                    description: card.querySelector('.sticker-card-body textarea').value
                })
            });
            await loadAdminStickers();
        } else if (button.classList.contains('share-btn')) {
            const modal = document.getElementById('share-modal');
            const urlInput = document.getElementById('share-url-input');
            const qrCanvas = document.getElementById('qr-code-canvas');
            const url = `${window.location.origin}${window.location.pathname}#add-sticker?id=${id}`;
            urlInput.value = url;
            new QRious({ element: qrCanvas, value: url, size: 220, padding: 10, foreground: '#333' });
            modal.classList.remove('hidden');
        } else if (button.classList.contains('feedback-btn')) {
            const modal = document.getElementById('feedback-modal');
            const title = document.getElementById('feedback-modal-title');
            const container = document.getElementById('feedback-list-container');
            const cardTitle = card.querySelector('.sticker-card-title').textContent;
            title.textContent = `Feedback for "${cardTitle}"`;
            container.innerHTML = '<p>Loading...</p>';
            modal.classList.remove('hidden');
            try {
                const response = await fetch(`/api?action=getFeedback&sticker_id=${id}`);
                const data = await response.json();
                if (data.success && data.feedback.length > 0) {
                    container.innerHTML = data.feedback.map(fb => `
                        <div class="feedback-item">
                            <p class="feedback-comment">"${fb.comment}"</p>
                            <p class="feedback-meta">
                                <strong>${fb.full_name}</strong> (${fb.employee_id}) - 
                                <small>${new Date(fb.submitted_at).toLocaleString()}</small>
                            </p>
                        </div>
                    `).join('');
                } else {
                    container.innerHTML = '<p>No feedback has been submitted for this event yet.</p>';
                }
            } catch (error) {
                container.innerHTML = '<p>Could not load feedback due to a server error.</p>';
            }
        }
    }

    async function loadAdminStickers() {
        const stickerCardList = document.getElementById('sticker-card-list');
        if (!stickerCardList) return;
        stickerCardList.innerHTML = '<p>Loading stickers...</p>';
        
        try {
            const response = await fetch('/api?action=getAllStickers');
            const data = await response.json();

            if (data.success && data.stickers) {
                stickerCardList.innerHTML = '';
                if (data.stickers.length === 0) {
                     stickerCardList.innerHTML = '<p>No stickers have been created yet.</p>';
                     return;
                }
                data.stickers.forEach(sticker => {
                    const card = document.createElement('div');
                    card.className = 'sticker-card';
                    card.dataset.stickerId = sticker.id;
                    
                    const eventName = sticker.event_name || '';
                    const eventDate = sticker.event_date || '';
                    const description = sticker.description || '';
                    const feedbackCount = sticker.feedback_count || 0;
                    
                    card.innerHTML = `
                        <div class="sticker-card-header">
                            <img src="${sticker.image_data}" alt="${eventName}" class="sticker-card-img">
                            <div class="sticker-card-title-block">
                                <h3 class="sticker-card-title" data-original-value="${eventName}">${eventName}</h3>
                                <p class="sticker-card-date" data-original-value="${eventDate}">${formatDate(eventDate)}</p>
                            </div>
                        </div>
                        <div class="sticker-card-body">
                            <p data-original-value="${description}">${description}</p>
                        </div>
                        <div class="sticker-card-stats">
                            <div class="stat-item">
                                <span class="material-icons" style="font-size: 20px;">groups</span>
                                <span>${sticker.collection_count || 0} Collected</span>
                            </div>
                        </div>
                        <div class="sticker-card-actions">
                            <button class="icon-btn share-btn" title="Share"><span class="material-icons">share</span></button>
                            <button class="icon-btn edit-btn" title="Edit"><span class="material-icons">edit</span></button>
                            <button class="icon-btn feedback-btn" title="View Feedback">
                                <span class="material-icons">chat_bubble_outline</span>
                                ${feedbackCount > 0 ? `<span class="badge">${feedbackCount}</span>` : ''}
                            </button>
                            <button class="icon-btn delete-btn" title="Delete"><span class="material-icons">delete</span></button>
                        </div>
                    `;
                    stickerCardList.appendChild(card);
                });
            } else {
                stickerCardList.innerHTML = `<p>Failed to load stickers: ${data.message || 'No stickers found.'}</p>`;
            }
        } catch (error) {
            stickerCardList.innerHTML = '<p>A server error occurred. Could not load stickers.</p>';
        }
    }

    initApp();
});
