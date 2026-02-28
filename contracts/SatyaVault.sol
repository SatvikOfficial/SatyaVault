// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SatyaVault - Immutable chain-of-custody for digital evidence
/// @notice Stores evidence hash + metadata, enforces agency roles, and logs all forensic actions.
contract SatyaVault {
    // -------------------------------------------------------------------------
    // Errors (gas-efficient)
    // -------------------------------------------------------------------------
    error EvidenceNotFound();
    error NotCurrentCustodian();
    error EmptyValue();
    error InvalidRole();
    error NotAdmin();
    error UnauthorizedRole();
    error InactiveActor();
    error AgencyMismatch();
    error InvalidCustodyPath();
    error SelfTransferNotAllowed();

    // -------------------------------------------------------------------------
    // Role model
    // -------------------------------------------------------------------------
    // NONE is intentionally zero-value for unconfigured actors.
    enum Role {
        NONE,
        INVESTIGATOR,
        FSL_OFFICER,
        COURT_OFFICER,
        AUDITOR,
        MINISTRY_ADMIN
    }

    // Actor profile is written by ministry admin and enforced at runtime.
    struct ActorProfile {
        Role role;
        string agency;
        bool active;
        uint256 updatedAt;
        address updatedBy;
    }

    // -------------------------------------------------------------------------
    // Evidence + custody model
    // -------------------------------------------------------------------------
    struct Evidence {
        uint256 evidenceId;
        bytes32 fileHash;
        string ipfsUri;
        string caseId;
        string investigatorId;
        uint256 createdAt;
        address createdBy;
        bool exists;
    }

    // One record per transfer between agencies/actors.
    struct CustodyEvent {
        address fromActor;
        address toActor;
        string fromOrg;
        string toOrg;
        string action;
        string notes;
        uint256 timestamp;
    }

    // Logs investigative steps done while evidence is in custody.
    struct InvestigationAction {
        address actor;
        string agency;
        string actionType;
        string actionNotes;
        string artifactUri;
        bytes32 actionRef;
        uint256 timestamp;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    uint256 public evidenceCount;
    address public systemAdmin;

    mapping(address => ActorProfile) private actorProfiles;

    mapping(uint256 => Evidence) private evidenceById;
    mapping(uint256 => CustodyEvent[]) private custodyHistory;
    mapping(uint256 => InvestigationAction[]) private investigationActions;

    // Tracks who currently controls an evidence item.
    mapping(uint256 => address) public currentCustodian;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event EvidenceRegistered(
        uint256 indexed evidenceId,
        bytes32 indexed fileHash,
        address indexed createdBy,
        string ipfsUri,
        string caseId,
        string investigatorId,
        uint256 timestamp
    );

    event CustodyTransferred(
        uint256 indexed evidenceId,
        address indexed fromActor,
        address indexed toActor,
        string fromOrg,
        string toOrg,
        string action,
        string notes,
        uint256 timestamp
    );

    event InvestigationActionLogged(
        uint256 indexed evidenceId,
        bytes32 indexed actionRef,
        address indexed actor,
        string agency,
        string actionType,
        string actionNotes,
        string artifactUri,
        uint256 timestamp
    );

    event ActorProfileUpdated(
        address indexed actor,
        Role indexed role,
        string agency,
        bool active,
        address updatedBy,
        uint256 timestamp
    );

    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin, uint256 timestamp);

    // -------------------------------------------------------------------------
    // Constructor + modifiers
    // -------------------------------------------------------------------------
    constructor() {
        // Deployer is bootstrap admin for first-time provisioning.
        systemAdmin = msg.sender;

        // Admin is also treated as an active ministry operator by default.
        actorProfiles[msg.sender] = ActorProfile({
            role: Role.MINISTRY_ADMIN,
            agency: "Ministry of Home Affairs",
            active: true,
            updatedAt: block.timestamp,
            updatedBy: msg.sender
        });

        emit ActorProfileUpdated(
            msg.sender,
            Role.MINISTRY_ADMIN,
            "Ministry of Home Affairs",
            true,
            msg.sender,
            block.timestamp
        );
    }

    modifier onlyAdmin() {
        if (msg.sender != systemAdmin) revert NotAdmin();
        _;
    }

    // -------------------------------------------------------------------------
    // Admin and actor profile management
    // -------------------------------------------------------------------------

    /// @notice Set or update actor profile used for on-chain access control.
    function setActorProfile(
        address actor,
        Role role,
        string calldata agency,
        bool active
    ) external onlyAdmin {
        if (actor == address(0)) revert EmptyValue();

        // Active actors must have a non-empty functional role.
        if (active && role == Role.NONE) revert InvalidRole();

        // Non-admin operational roles must carry an agency binding.
        if (role != Role.NONE && role != Role.MINISTRY_ADMIN && bytes(agency).length == 0) {
            revert EmptyValue();
        }

        actorProfiles[actor] = ActorProfile({
            role: role,
            agency: agency,
            active: active,
            updatedAt: block.timestamp,
            updatedBy: msg.sender
        });

        emit ActorProfileUpdated(actor, role, agency, active, msg.sender, block.timestamp);
    }

    /// @notice Transfers platform admin ownership to another address.
    function setSystemAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert EmptyValue();

        address previous = systemAdmin;
        systemAdmin = newAdmin;

        // Ensure new admin can immediately operate without extra transactions.
        ActorProfile storage profile = actorProfiles[newAdmin];
        if (!profile.active || profile.role != Role.MINISTRY_ADMIN) {
            actorProfiles[newAdmin] = ActorProfile({
                role: Role.MINISTRY_ADMIN,
                agency: bytes(profile.agency).length == 0 ? "Ministry of Home Affairs" : profile.agency,
                active: true,
                updatedAt: block.timestamp,
                updatedBy: msg.sender
            });

            emit ActorProfileUpdated(
                newAdmin,
                Role.MINISTRY_ADMIN,
                actorProfiles[newAdmin].agency,
                true,
                msg.sender,
                block.timestamp
            );
        }

        emit AdminUpdated(previous, newAdmin, block.timestamp);
    }

    /// @notice Read actor profile for UI and backend authorization checks.
    function getActorProfile(address actor) external view returns (ActorProfile memory) {
        return actorProfiles[actor];
    }

    // -------------------------------------------------------------------------
    // Evidence lifecycle
    // -------------------------------------------------------------------------

    /// @notice Register new evidence and initialize first custody record.
    /// @dev Only active Investigator or Ministry Admin actors can register.
    function registerEvidence(
        bytes32 fileHash,
        string calldata ipfsUri,
        string calldata caseId,
        string calldata investigatorId,
        string calldata initialOrg
    ) external returns (uint256 newEvidenceId) {
        if (bytes(ipfsUri).length == 0) revert EmptyValue();
        if (bytes(caseId).length == 0) revert EmptyValue();
        if (bytes(investigatorId).length == 0) revert EmptyValue();
        if (bytes(initialOrg).length == 0) revert EmptyValue();

        ActorProfile memory actor = _requireActiveActor(msg.sender);
        if (!_canRegister(actor.role)) revert UnauthorizedRole();

        // Ministry can register on behalf of any org. Others must match profile.
        if (actor.role != Role.MINISTRY_ADMIN && !_sameText(actor.agency, initialOrg)) {
            revert AgencyMismatch();
        }

        evidenceCount += 1;
        newEvidenceId = evidenceCount;

        evidenceById[newEvidenceId] = Evidence({
            evidenceId: newEvidenceId,
            fileHash: fileHash,
            ipfsUri: ipfsUri,
            caseId: caseId,
            investigatorId: investigatorId,
            createdAt: block.timestamp,
            createdBy: msg.sender,
            exists: true
        });

        currentCustodian[newEvidenceId] = msg.sender;

        custodyHistory[newEvidenceId].push(
            CustodyEvent({
                fromActor: address(0),
                toActor: msg.sender,
                fromOrg: "Origin",
                toOrg: initialOrg,
                action: "EVIDENCE_SUBMITTED",
                notes: "Initial registration into SatyaVault",
                timestamp: block.timestamp
            })
        );

        emit EvidenceRegistered(
            newEvidenceId,
            fileHash,
            msg.sender,
            ipfsUri,
            caseId,
            investigatorId,
            block.timestamp
        );

        emit CustodyTransferred(
            newEvidenceId,
            address(0),
            msg.sender,
            "Origin",
            initialOrg,
            "EVIDENCE_SUBMITTED",
            "Initial registration into SatyaVault",
            block.timestamp
        );
    }

    /// @notice Transfer evidence custody to next actor and store audit entry.
    /// @dev Sender must be current custodian and both actors must be active + authorized.
    function transferCustody(
        uint256 evidenceId,
        address toActor,
        string calldata fromOrg,
        string calldata toOrg,
        string calldata action,
        string calldata notes
    ) external {
        Evidence memory item = evidenceById[evidenceId];
        if (!item.exists) revert EvidenceNotFound();
        if (currentCustodian[evidenceId] != msg.sender) revert NotCurrentCustodian();
        if (toActor == address(0)) revert EmptyValue();
        if (msg.sender == toActor) revert SelfTransferNotAllowed();
        if (bytes(fromOrg).length == 0) revert EmptyValue();
        if (bytes(toOrg).length == 0) revert EmptyValue();
        if (bytes(action).length == 0) revert EmptyValue();

        ActorProfile memory sender = _requireActiveActor(msg.sender);
        ActorProfile memory receiver = _requireActiveActor(toActor);

        if (!_canTransfer(sender.role) || !_canTransfer(receiver.role)) {
            revert UnauthorizedRole();
        }

        // Ministry admin can orchestrate cross-agency operations; others are bound to profile agency.
        if (sender.role != Role.MINISTRY_ADMIN && !_sameText(sender.agency, fromOrg)) {
            revert AgencyMismatch();
        }

        if (receiver.role != Role.MINISTRY_ADMIN && !_sameText(receiver.agency, toOrg)) {
            revert AgencyMismatch();
        }

        // Enforce predefined role transition matrix for operational actors.
        if (!_isAllowedCustodyPath(sender.role, receiver.role)) {
            revert InvalidCustodyPath();
        }

        custodyHistory[evidenceId].push(
            CustodyEvent({
                fromActor: msg.sender,
                toActor: toActor,
                fromOrg: fromOrg,
                toOrg: toOrg,
                action: action,
                notes: notes,
                timestamp: block.timestamp
            })
        );

        currentCustodian[evidenceId] = toActor;

        emit CustodyTransferred(
            evidenceId,
            msg.sender,
            toActor,
            fromOrg,
            toOrg,
            action,
            notes,
            block.timestamp
        );
    }

    /// @notice Immutable log for investigative operations performed on evidence.
    /// @dev Current custodian (or ministry admin) signs each action on chain.
    function recordInvestigativeAction(
        uint256 evidenceId,
        string calldata actionType,
        string calldata actionNotes,
        string calldata artifactUri
    ) external returns (bytes32 actionRef) {
        Evidence memory item = evidenceById[evidenceId];
        if (!item.exists) revert EvidenceNotFound();
        if (bytes(actionType).length == 0) revert EmptyValue();

        ActorProfile memory actor = _requireActiveActor(msg.sender);
        if (!_canLogAction(actor.role)) revert UnauthorizedRole();

        if (currentCustodian[evidenceId] != msg.sender && actor.role != Role.MINISTRY_ADMIN) {
            revert NotCurrentCustodian();
        }

        // Deterministic reference allows off-chain systems to correlate action records.
        actionRef = keccak256(
            abi.encodePacked(
                evidenceId,
                msg.sender,
                actionType,
                actionNotes,
                artifactUri,
                block.timestamp
            )
        );

        investigationActions[evidenceId].push(
            InvestigationAction({
                actor: msg.sender,
                agency: actor.agency,
                actionType: actionType,
                actionNotes: actionNotes,
                artifactUri: artifactUri,
                actionRef: actionRef,
                timestamp: block.timestamp
            })
        );

        emit InvestigationActionLogged(
            evidenceId,
            actionRef,
            msg.sender,
            actor.agency,
            actionType,
            actionNotes,
            artifactUri,
            block.timestamp
        );
    }

    // -------------------------------------------------------------------------
    // Read APIs
    // -------------------------------------------------------------------------

    /// @notice Fetch immutable evidence metadata.
    function getEvidence(uint256 evidenceId) external view returns (Evidence memory) {
        Evidence memory item = evidenceById[evidenceId];
        if (!item.exists) revert EvidenceNotFound();
        return item;
    }

    /// @notice Fetch full custody timeline for UI rendering.
    function getCustodyHistory(uint256 evidenceId) external view returns (CustodyEvent[] memory) {
        Evidence memory item = evidenceById[evidenceId];
        if (!item.exists) revert EvidenceNotFound();
        return custodyHistory[evidenceId];
    }

    /// @notice Fetch investigative action timeline for UI rendering.
    function getInvestigationActions(uint256 evidenceId)
        external
        view
        returns (InvestigationAction[] memory)
    {
        Evidence memory item = evidenceById[evidenceId];
        if (!item.exists) revert EvidenceNotFound();
        return investigationActions[evidenceId];
    }

    /// @notice Verifies if a locally computed hash matches on-chain hash.
    function verifyIntegrity(uint256 evidenceId, bytes32 localHash) external view returns (bool) {
        Evidence memory item = evidenceById[evidenceId];
        if (!item.exists) revert EvidenceNotFound();
        return item.fileHash == localHash;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _requireActiveActor(address actorAddress) internal view returns (ActorProfile memory profile) {
        profile = actorProfiles[actorAddress];
        if (!profile.active || profile.role == Role.NONE) revert InactiveActor();
    }

    function _canRegister(Role role) internal pure returns (bool) {
        return role == Role.INVESTIGATOR || role == Role.MINISTRY_ADMIN;
    }

    function _canTransfer(Role role) internal pure returns (bool) {
        return role == Role.INVESTIGATOR || role == Role.FSL_OFFICER || role == Role.COURT_OFFICER || role == Role.MINISTRY_ADMIN;
    }

    function _canLogAction(Role role) internal pure returns (bool) {
        return role == Role.INVESTIGATOR || role == Role.FSL_OFFICER || role == Role.COURT_OFFICER || role == Role.MINISTRY_ADMIN;
    }

    function _isAllowedCustodyPath(Role fromRole, Role toRole) internal pure returns (bool) {
        // Ministry can supervise or intervene in any phase.
        if (fromRole == Role.MINISTRY_ADMIN || toRole == Role.MINISTRY_ADMIN) {
            return true;
        }

        // Enforced operational progression:
        // Investigator -> FSL -> Court, with court remand back to FSL when required.
        if (fromRole == Role.INVESTIGATOR && toRole == Role.FSL_OFFICER) {
            return true;
        }

        if (fromRole == Role.FSL_OFFICER && toRole == Role.COURT_OFFICER) {
            return true;
        }

        if (fromRole == Role.COURT_OFFICER && toRole == Role.FSL_OFFICER) {
            return true;
        }

        return false;
    }

    function _sameText(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
